/**
 * Cerebro — Alexa Voice Capture & Query Edge Function
 *
 * Supabase Edge Function that acts as an Alexa Custom Skill HTTPS endpoint.
 * Handles voice capture, semantic search, stats, browse, and task management.
 *
 * Invocation: "Alexa, tell cerebro ..." / "Alexa, ask cerebro ..."
 */

import { Hono } from "https://deno.land/x/hono@v4.9.2/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import {
  decode as decodeBase64,
} from "https://deno.land/std@0.224.0/encoding/base64.ts";

const app = new Hono();

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const ALEXA_SKILL_ID = Deno.env.get("ALEXA_SKILL_ID"); // optional — verify if set

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---------------------------------------------------------------------------
// Alexa Request Signature Verification
// ---------------------------------------------------------------------------

// Certificate cache: URL -> { cert, notAfter }
const certCache = new Map<string, { cert: Uint8Array; notAfter: Date; pem: string }>();

function validateCertUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "s3.amazonaws.com" &&
      url.pathname.startsWith("/echo.api/") &&
      (!url.port || url.port === "443")
    );
  } catch {
    return false;
  }
}

async function fetchSigningCert(certUrl: string): Promise<{ cert: Uint8Array; pem: string }> {
  const cached = certCache.get(certUrl);
  if (cached && cached.notAfter > new Date()) {
    return { cert: cached.cert, pem: cached.pem };
  }

  const resp = await fetch(certUrl);
  if (!resp.ok) throw new Error(`Failed to fetch signing cert: ${resp.status}`);
  const pem = await resp.text();

  // Extract DER from PEM
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
  const der = decodeBase64(b64);

  // Cache for 24 hours (certs are long-lived)
  const notAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
  certCache.set(certUrl, { cert: der, notAfter, pem });

  return { cert: der, pem };
}

async function verifyAlexaRequest(
  certUrl: string,
  signature: string,
  body: string
): Promise<boolean> {
  // 1. Validate cert URL
  if (!validateCertUrl(certUrl)) return false;

  // 2. Fetch and parse cert
  const { pem } = await fetchSigningCert(certUrl);

  // 3. Import the public key from the PEM certificate
  const pemKey = pem.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/
  );
  if (!pemKey) return false;

  // Use Deno's native X.509 parsing via crypto.subtle
  const certB64 = pemKey[0]
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s/g, "");
  const certDer = decodeBase64(certB64);

  // Extract public key using SubtleCrypto — import the X.509 cert
  // Deno supports importKey with "spki" format; we need to extract SPKI from X.509
  const spki = extractSPKIFromX509(certDer);
  if (!spki) return false;

  const publicKey = await crypto.subtle.importKey(
    "spki",
    spki,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" },
    false,
    ["verify"]
  );

  // 4. Verify signature
  const sigBytes = decodeBase64(signature);
  const bodyBytes = new TextEncoder().encode(body);

  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, sigBytes, bodyBytes);
}

/**
 * Extract SubjectPublicKeyInfo from a DER-encoded X.509 certificate.
 * Minimal ASN.1 parser — walks the TBS certificate to find the SPKI field.
 */
function extractSPKIFromX509(der: Uint8Array): Uint8Array | null {
  try {
    // X.509 Certificate structure:
    // SEQUENCE { tbsCertificate, signatureAlgorithm, signatureValue }
    // tbsCertificate SEQUENCE {
    //   version [0] EXPLICIT, serialNumber, signature, issuer, validity,
    //   subject, subjectPublicKeyInfo, ... }
    let offset = 0;

    function readTag(): { tag: number; length: number; start: number } {
      const start = offset;
      const tag = der[offset++];
      let length = der[offset++];
      if (length & 0x80) {
        const numBytes = length & 0x7f;
        length = 0;
        for (let i = 0; i < numBytes; i++) {
          length = (length << 8) | der[offset++];
        }
      }
      return { tag, length, start };
    }

    function skipElement() {
      const { length } = readTag();
      offset += length;
    }

    function readSequenceHeader(): number {
      const { tag, length } = readTag();
      if ((tag & 0x1f) !== 0x10) throw new Error("Expected SEQUENCE");
      return length;
    }

    // Outer SEQUENCE (Certificate)
    readSequenceHeader();

    // TBS Certificate SEQUENCE
    const tbsStart = offset;
    readSequenceHeader();

    // Version [0] EXPLICIT (optional — skip if present)
    if (der[offset] === 0xa0) {
      skipElement();
    }

    // serialNumber
    skipElement();
    // signature algorithm
    skipElement();
    // issuer
    skipElement();
    // validity
    skipElement();
    // subject
    skipElement();

    // subjectPublicKeyInfo — this is what we want
    const spkiTag = readTag();
    const spkiBytes = der.slice(spkiTag.start, offset + spkiTag.length);
    return spkiBytes;
  } catch {
    return null;
  }
}

function isTimestampValid(timestamp: string): boolean {
  const requestTime = new Date(timestamp).getTime();
  const now = Date.now();
  return Math.abs(now - requestTime) < 150_000; // 150 seconds
}

// ---------------------------------------------------------------------------
// Alexa Response Helpers
// ---------------------------------------------------------------------------

function alexaResponse(speech: string, endSession = true, reprompt?: string) {
  const response: Record<string, unknown> = {
    outputSpeech: { type: "PlainText", text: speech },
    shouldEndSession: endSession,
  };
  if (reprompt) {
    response.reprompt = { outputSpeech: { type: "PlainText", text: reprompt } };
  }
  return { version: "1.0", response };
}

// ---------------------------------------------------------------------------
// AI Pipeline (shared with other integrations)
// ---------------------------------------------------------------------------

async function getEmbedding(text: string): Promise<number[]> {
  const resp = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: text,
    }),
  });
  const data = await resp.json();
  return data.data[0].embedding;
}

async function extractMetadata(
  text: string
): Promise<{ title: string; thought_type: string; tags: string[]; people: string[] }> {
  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Extract metadata from this thought. Return JSON only:
{"title":"short title","thought_type":"one of: idea|task|person_note|project_update|meeting_note|decision|reflection|reference","tags":["tag1"],"people":["Name"]}`,
        },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const data = await resp.json();
  return JSON.parse(data.choices[0].message.content);
}

// ---------------------------------------------------------------------------
// Speech Helpers (reused from cerebro-oss)
// ---------------------------------------------------------------------------

function truncateForSpeech(text: string, maxChars: number): string {
  if (!text) return "";
  const cleaned = text.replace(/[#*_`>\[\](){}|]/g, "").replace(/\n+/g, ". ");
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.substring(0, maxChars).replace(/\s\S*$/, "") + "...";
}

function formatDate(isoString: string | null): string {
  if (!isoString) return "an unknown date";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  } catch {
    return "an unknown date";
  }
}

function formatTypeName(type: string): string {
  return type.replace(/_/g, " ");
}

// Type map: spoken slot values → DB type values
const TYPE_MAP: Record<string, string> = {
  ideas: "idea",
  tasks: "task",
  "person notes": "person_note",
  "project updates": "project_update",
  "meeting notes": "meeting_note",
  decisions: "decision",
  reflections: "reflection",
  references: "reference",
};

// ---------------------------------------------------------------------------
// Intent Handlers
// ---------------------------------------------------------------------------

async function handleCapture(thought: string | undefined) {
  if (!thought) {
    return alexaResponse(
      "I didn't catch that. What would you like me to remember?",
      false,
      "What thought should I capture?"
    );
  }

  try {
    const [embedding, metadata] = await Promise.all([
      getEmbedding(thought),
      extractMetadata(thought),
    ]);

    const { error } = await supabase.from("thoughts").insert({
      content: thought,
      title: metadata.title,
      thought_type: metadata.thought_type,
      tags: metadata.tags,
      people: metadata.people,
      embedding,
      metadata: { source: "alexa" },
    });

    if (error) throw error;

    return alexaResponse(
      `Captured: ${metadata.title || thought}. Tagged as ${formatTypeName(metadata.thought_type || "thought")}.`
    );
  } catch (err) {
    console.error("Capture error:", err);
    return alexaResponse("Something went wrong saving that thought. Try again.");
  }
}

async function handleSearch(query: string | undefined) {
  if (!query) {
    return alexaResponse(
      "What would you like to search for?",
      false,
      "Tell me what to look up."
    );
  }

  try {
    const embedding = await getEmbedding(query);

    const { data: results, error } = await supabase.rpc("match_thoughts", {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 3,
    });

    if (error) throw error;

    if (!results || results.length === 0) {
      return alexaResponse(`I couldn't find anything matching "${query}".`);
    }

    const top = results[0];
    const snippet = truncateForSpeech(top.content, 120);
    const date = formatDate(top.created_at);

    let speech = `I found ${results.length} result${results.length > 1 ? "s" : ""}. `;
    speech += `Best match: ${top.title || "untitled"}, from ${date}. ${snippet}.`;

    if (results.length > 1) {
      speech += ` Other matches include: ${results
        .slice(1)
        .map((r: { title?: string }) => r.title || "untitled")
        .join(", and ")}.`;
    }

    return alexaResponse(speech);
  } catch (err) {
    console.error("Search error:", err);
    return alexaResponse("Something went wrong searching. Try again.");
  }
}

async function handleStats() {
  try {
    const { count, error: countErr } = await supabase
      .from("thoughts")
      .select("*", { count: "exact", head: true });

    if (countErr) throw countErr;

    const { data: recent } = await supabase
      .from("thoughts")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: typeRows } = await supabase
      .from("thoughts")
      .select("thought_type");

    // Count by type
    const byType: Record<string, number> = {};
    for (const row of typeRows || []) {
      const t = row.thought_type || "unknown";
      byType[t] = (byType[t] || 0) + 1;
    }
    const topTypes = Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, cnt]) => `${formatTypeName(type)} at ${cnt}`)
      .join(", ");

    const newest = recent?.[0]?.created_at;

    let speech = `You have ${count || 0} thoughts. Most recent was ${formatDate(newest)}. `;
    if (topTypes) speech += `Top types: ${topTypes}.`;

    return alexaResponse(speech);
  } catch (err) {
    console.error("Stats error:", err);
    return alexaResponse("I couldn't get your stats right now. Try again.");
  }
}

async function handleBrowseRecent(typeSlot: string | undefined) {
  try {
    const apiType = typeSlot ? TYPE_MAP[typeSlot.toLowerCase()] || typeSlot : undefined;

    let query = supabase
      .from("thoughts")
      .select("title, created_at, thought_type")
      .order("created_at", { ascending: false })
      .limit(5);

    if (apiType) {
      query = query.eq("thought_type", apiType);
    }

    const { data: thoughts, error } = await query;
    if (error) throw error;

    if (!thoughts || thoughts.length === 0) {
      const qualifier = apiType ? ` of type ${typeSlot}` : "";
      return alexaResponse(`No recent thoughts found${qualifier}.`);
    }

    const typeLabel = typeSlot ? ` ${typeSlot}` : " thoughts";
    let speech = `Here are your ${thoughts.length} most recent${typeLabel}. `;

    thoughts.forEach((t: { title?: string; created_at?: string }, i: number) => {
      speech += `${i + 1}: ${t.title || "untitled"}, from ${formatDate(t.created_at || null)}. `;
    });

    return alexaResponse(speech);
  } catch (err) {
    console.error("Browse error:", err);
    return alexaResponse("I couldn't browse your recent thoughts right now. Try again.");
  }
}

async function handleCompleteTask(task: string | undefined) {
  if (!task) {
    return alexaResponse("Which task did you finish?", false, "Tell me which task to mark as done.");
  }

  try {
    // Search for matching open tasks
    const embedding = await getEmbedding(task);
    const { data: results } = await supabase.rpc("match_thoughts", {
      query_embedding: embedding,
      match_threshold: 0.4,
      match_count: 5,
    });

    const openTask = results?.find(
      (r: { thought_type?: string; metadata?: Record<string, unknown> }) =>
        r.thought_type === "task" && r.metadata?.status !== "done"
    );

    if (openTask) {
      await supabase
        .from("thoughts")
        .update({ metadata: { ...openTask.metadata, status: "done", source: openTask.metadata?.source } })
        .eq("id", openTask.id);

      return alexaResponse(`Marked done: ${openTask.title || task}.`);
    }

    return alexaResponse(
      `I couldn't find a matching open task for "${task}". It was captured as a new thought instead.`
    );
  } catch (err) {
    console.error("Complete task error:", err);
    return alexaResponse("Something went wrong. Try again.");
  }
}

async function handleReopenTask(task: string | undefined) {
  if (!task) {
    return alexaResponse("Which task should I reopen?", false, "Tell me which task to reopen.");
  }

  try {
    const embedding = await getEmbedding(task);
    const { data: results } = await supabase.rpc("match_thoughts", {
      query_embedding: embedding,
      match_threshold: 0.4,
      match_count: 5,
    });

    const doneTask = results?.find(
      (r: { thought_type?: string; metadata?: Record<string, unknown> }) =>
        r.thought_type === "task" && r.metadata?.status === "done"
    );

    if (doneTask) {
      const { status: _removed, ...restMeta } = (doneTask.metadata || {}) as Record<string, unknown>;
      await supabase
        .from("thoughts")
        .update({ metadata: { ...restMeta, source: doneTask.metadata?.source } })
        .eq("id", doneTask.id);

      return alexaResponse(`Reopened: ${doneTask.title || task}.`);
    }

    return alexaResponse(`I couldn't find a completed task matching "${task}".`);
  } catch (err) {
    console.error("Reopen task error:", err);
    return alexaResponse("Something went wrong. Try again.");
  }
}

// ---------------------------------------------------------------------------
// Main Route
// ---------------------------------------------------------------------------

app.post("/", async (c) => {
  const rawBody = await c.req.text();

  // Verify Alexa request signature (skip in development if env var set)
  const skipVerification = Deno.env.get("ALEXA_SKIP_VERIFICATION") === "true";
  if (!skipVerification) {
    const certUrl = c.req.header("signaturecertchainurl") || "";
    const signature = c.req.header("signature-256") || c.req.header("signature") || "";

    try {
      const valid = await verifyAlexaRequest(certUrl, signature, rawBody);
      if (!valid) {
        return c.json({ error: "Invalid signature" }, 403);
      }
    } catch (err) {
      console.error("Signature verification failed:", err);
      return c.json({ error: "Signature verification failed" }, 403);
    }
  }

  const body = JSON.parse(rawBody);

  // Verify skill ID if configured
  if (ALEXA_SKILL_ID) {
    const requestSkillId =
      body.session?.application?.applicationId ||
      body.context?.System?.application?.applicationId;
    if (requestSkillId !== ALEXA_SKILL_ID) {
      return c.json({ error: "Skill ID mismatch" }, 403);
    }
  }

  // Verify timestamp
  const timestamp = body.request?.timestamp;
  if (timestamp && !isTimestampValid(timestamp)) {
    return c.json({ error: "Request too old" }, 400);
  }

  const requestType = body.request?.type;
  const intentName = body.request?.intent?.name;
  const slots = body.request?.intent?.slots || {};

  // Route by request type and intent
  switch (requestType) {
    case "LaunchRequest":
      return c.json(
        alexaResponse(
          "Welcome to Cerebro. You can capture a thought, search for something, " +
            "mark a task as done, or ask for stats. What would you like to do?",
          false,
          "Try saying: capture, search, done, or stats."
        )
      );

    case "IntentRequest":
      switch (intentName) {
        case "CaptureThoughtIntent":
          return c.json(await handleCapture(slots.thought?.value));

        case "SearchIntent":
          return c.json(await handleSearch(slots.query?.value));

        case "StatsIntent":
          return c.json(await handleStats());

        case "BrowseRecentIntent":
          return c.json(await handleBrowseRecent(slots.type?.value));

        case "CompleteTaskIntent":
          return c.json(await handleCompleteTask(slots.task?.value));

        case "ReopenTaskIntent":
          return c.json(await handleReopenTask(slots.task?.value));

        case "AMAZON.HelpIntent":
          return c.json(
            alexaResponse(
              'Here\'s what I can do. ' +
                'Say "capture" followed by a thought to save it. ' +
                'Say "search" followed by a topic to look something up. ' +
                'Say "done" followed by a task to mark it complete. ' +
                'Say "reopen" followed by a task to bring it back. ' +
                'Say "stats" to hear about your brain. ' +
                'Or say "what\'s recent" to hear your latest thoughts.',
              false,
              "What would you like to do?"
            )
          );

        case "AMAZON.StopIntent":
        case "AMAZON.CancelIntent":
          return c.json(alexaResponse("Goodbye."));

        case "AMAZON.FallbackIntent":
          return c.json(
            alexaResponse(
              "I didn't understand that. Try saying capture, search, done, stats, or what's recent.",
              false,
              "What would you like to do?"
            )
          );

        default:
          return c.json(
            alexaResponse("I'm not sure how to handle that. Try saying help.")
          );
      }

    case "SessionEndedRequest":
      return c.json({ version: "1.0", response: {} });

    default:
      return c.json(alexaResponse("Something unexpected happened."));
  }
});

// Health check
app.get("/", (c) => c.json({ status: "ok", skill: "cerebro-alexa" }));

Deno.serve(app.fetch);
