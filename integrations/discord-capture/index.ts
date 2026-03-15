import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import nacl from "tweetnacl";

// --- Environment ---

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const DISCORD_PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY")!;
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Ed25519 Signature Verification ---

function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(
    hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
  );
}

async function verifyDiscordSignature(
  req: Request,
): Promise<{ valid: boolean; body: string }> {
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const body = await req.text();

  if (!signature || !timestamp) {
    return { valid: false, body };
  }

  const isValid = nacl.sign.detached.verify(
    new TextEncoder().encode(timestamp + body),
    hexToUint8Array(signature),
    hexToUint8Array(DISCORD_PUBLIC_KEY),
  );

  return { valid: isValid, body };
}

// --- OpenRouter: Embedding + Metadata ---

async function getEmbedding(text: string): Promise<number[]> {
  const r = await fetch(`${OPENROUTER_BASE}/embeddings`, {
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
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`OpenRouter embeddings failed: ${r.status} ${msg}`);
  }
  const d = await r.json();
  return d.data[0].embedding;
}

function buildMetadataPrompt(): string {
  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const iso = now.toISOString();

  return `You are a metadata extractor for a personal knowledge base.
Current datetime: ${dayName}, ${iso}

Given a thought, return JSON matching this schema:
{
  "title": "short descriptive title (max 60 chars)",
  "type": "idea|task|person_note|project_update|meeting_note|decision|reflection|reference|observation",
  "people": ["names mentioned"],
  "topics": ["1-3 relevant topic tags"],
  "action_items": ["any action items"],
  "has_reminder": false,
  "reminder_title": "",
  "reminder_datetime": ""
}

Rules:
- has_reminder: true if a date/time is mentioned for a future event or reminder
- reminder_datetime: ISO 8601 with timezone offset. Default time 09:00, timezone -06:00 (Central)
- reminder_title: brief title for the calendar event (e.g. "Call dentist")
- Only extract what's explicitly there.`;
}

async function extractMetadata(
  text: string,
): Promise<Record<string, unknown>> {
  const r = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildMetadataPrompt() },
        { role: "user", content: text },
      ],
    }),
  });
  const d = await r.json();
  try {
    return JSON.parse(d.choices[0].message.content);
  } catch {
    return { topics: ["uncategorized"], type: "observation" };
  }
}

// --- Calendar Reminder Creation ---

async function getGraphToken(): Promise<string | null> {
  const tenantId = Deno.env.get("GRAPH_TENANT_ID");
  const clientId = Deno.env.get("GRAPH_CLIENT_ID");
  const clientSecret = Deno.env.get("GRAPH_CLIENT_SECRET");
  if (!tenantId || !clientId || !clientSecret) return null;

  const r = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );
  const data = await r.json();
  return data.access_token || null;
}

async function createO365Event(title: string, datetime: string, body: string): Promise<boolean> {
  const userEmail = Deno.env.get("CALENDAR_USER_EMAIL");
  const token = await getGraphToken();
  if (!token || !userEmail) return false;

  const startTime = new Date(datetime);
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

  const r = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userEmail}/calendar/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: title,
        body: { contentType: "Text", content: body },
        start: { dateTime: startTime.toISOString(), timeZone: "UTC" },
        end: { dateTime: endTime.toISOString(), timeZone: "UTC" },
        isReminderOn: true,
        reminderMinutesBeforeStart: 15,
      }),
    },
  );
  return r.ok;
}

async function getGoogleAccessToken(): Promise<string | null> {
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) return null;

  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);

  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const claim = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const signingInput = `${header}.${claim}`;
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8", keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${signingInput}.${sigB64}`,
    }),
  });
  const data = await r.json();
  return data.access_token || null;
}

async function createGoogleEvent(title: string, datetime: string, body: string): Promise<boolean> {
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
  const token = await getGoogleAccessToken();
  if (!token || !calendarId) return false;

  const startTime = new Date(datetime);
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: title,
        description: body,
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
      }),
    },
  );
  return r.ok;
}

async function createCalendarReminders(
  metadata: Record<string, unknown>, content: string,
): Promise<string[]> {
  if (!metadata.has_reminder || !metadata.reminder_datetime) return [];
  const title = (metadata.reminder_title as string) || "Cerebro Reminder";
  const datetime = metadata.reminder_datetime as string;
  const created: string[] = [];
  const [o365, google] = await Promise.all([
    createO365Event(title, datetime, content).catch(() => false),
    createGoogleEvent(title, datetime, content).catch(() => false),
  ]);
  if (o365) created.push("O365");
  if (google) created.push("Google");
  return created;
}

// --- Discord follow-up message (for deferred responses) ---

async function sendFollowup(
  applicationId: string,
  interactionToken: string,
  content: string,
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    console.error(`Discord followup failed: ${r.status} ${msg}`);
  }
}

// --- Hono App ---

const app = new Hono();

app.post("*", async (c) => {
  // Clone request for signature verification (need raw body)
  const clonedReq = c.req.raw.clone();
  const { valid, body } = await verifyDiscordSignature(clonedReq);

  if (!valid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const interaction = JSON.parse(body);

  // Type 1: PING — Discord verification handshake
  if (interaction.type === 1) {
    return c.json({ type: 1 });
  }

  // Type 2: Application Command (slash command)
  if (interaction.type === 2) {
    const commandName = interaction.data?.name;

    if (commandName === "capture") {
      const thought =
        interaction.data?.options?.find(
          (o: { name: string }) => o.name === "thought",
        )?.value || "";

      if (!thought) {
        return c.json({
          type: 4,
          data: {
            content:
              "Please provide a thought to capture. Usage: `/capture thought:your thought here`",
          },
        });
      }

      // Respond with "thinking..." (deferred), then process async
      // Type 5 = DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
      const applicationId = interaction.application_id;
      const interactionToken = interaction.token;
      const senderName =
        interaction.member?.user?.username ||
        interaction.user?.username ||
        "unknown";

      // Use EdgeRuntime.waitUntil to process after responding
      const processPromise = (async () => {
        try {
          const [embedding, metadata] = await Promise.all([
            getEmbedding(thought),
            extractMetadata(thought),
          ]);

          const { error } = await supabase.from("thoughts").insert({
            content: thought,
            embedding,
            metadata: {
              ...metadata,
              source: "discord",
              discord_sender: senderName,
            },
          });

          if (error) {
            console.error("Supabase insert error:", error);
            await sendFollowup(
              applicationId,
              interactionToken,
              `❌ Failed to capture: ${error.message}`,
            );
            return;
          }

          const meta = metadata as Record<string, unknown>;
          let confirmation = `✅ Captured as **${meta.type || "thought"}**`;
          if (Array.isArray(meta.topics) && meta.topics.length)
            confirmation += ` — ${(meta.topics as string[]).join(", ")}`;
          if (Array.isArray(meta.people) && meta.people.length)
            confirmation += `\n👤 People: ${(meta.people as string[]).join(", ")}`;
          if (Array.isArray(meta.action_items) && meta.action_items.length)
            confirmation += `\n📋 Actions: ${(meta.action_items as string[]).join("; ")}`;

          // Create calendar reminders if detected
          const calendars = await createCalendarReminders(meta, thought);
          if (calendars.length) {
            confirmation += `\n⏰ Reminder created on ${calendars.join(" + ")}`;
          } else if (meta.has_reminder) {
            confirmation += `\n⏰ Reminder detected but no calendar configured`;
          }

          await sendFollowup(
            applicationId,
            interactionToken,
            confirmation,
          );
        } catch (err) {
          console.error("Processing error:", err);
          await sendFollowup(
            applicationId,
            interactionToken,
            `❌ Error: ${(err as Error).message}`,
          );
        }
      })();

      // Wait for processing in the background
      EdgeRuntime.waitUntil(processPromise);

      // Return deferred response immediately
      return c.json({ type: 5 });
    }

    if (commandName === "search") {
      const query =
        interaction.data?.options?.find(
          (o: { name: string }) => o.name === "query",
        )?.value || "";

      if (!query) {
        return c.json({
          type: 4,
          data: { content: "Please provide a search query." },
        });
      }

      const applicationId = interaction.application_id;
      const interactionToken = interaction.token;

      const searchPromise = (async () => {
        try {
          const qEmb = await getEmbedding(query);
          const { data, error } = await supabase.rpc("match_thoughts", {
            query_embedding: qEmb,
            match_threshold: 0.5,
            match_count: 5,
            filter: {},
          });

          if (error) {
            await sendFollowup(
              applicationId,
              interactionToken,
              `❌ Search error: ${error.message}`,
            );
            return;
          }

          if (!data || data.length === 0) {
            await sendFollowup(
              applicationId,
              interactionToken,
              `No thoughts found matching "${query}".`,
            );
            return;
          }

          const results = data.map(
            (
              t: {
                content: string;
                metadata: Record<string, unknown>;
                similarity: number;
                created_at: string;
              },
              i: number,
            ) => {
              const m = t.metadata || {};
              const topicStr = Array.isArray(m.topics)
                ? ` (${(m.topics as string[]).join(", ")})`
                : "";
              return `**${i + 1}.** [${(t.similarity * 100).toFixed(0)}% match]${topicStr}\n${t.content}`;
            },
          );

          await sendFollowup(
            applicationId,
            interactionToken,
            `🔍 Found ${data.length} thought(s):\n\n${results.join("\n\n")}`,
          );
        } catch (err) {
          console.error("Search error:", err);
          await sendFollowup(
            applicationId,
            interactionToken,
            `❌ Error: ${(err as Error).message}`,
          );
        }
      })();

      EdgeRuntime.waitUntil(searchPromise);
      return c.json({ type: 5 });
    }

    // Unknown command
    return c.json({
      type: 4,
      data: { content: "Unknown command." },
    });
  }

  return c.json({}, 200);
});

// Health check
app.get("*", (c) =>
  c.json({ status: "ok", service: "cerebro-discord" }),
);

Deno.serve(app.fetch);
