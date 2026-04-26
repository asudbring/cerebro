/**
 * Cerebro — Microsoft Graph Ingest Edge Function
 *
 * Polls Microsoft 365 sources (mail, calendar, OneNote, files) on a schedule
 * and stores items "worth learning" as `thoughts` rows.
 *
 * Triggered daily by pg_cron + pg_net, or on-demand via HTTP POST.
 *
 * POST body: { "source": "all" | "mail" | "event" | "onenote" | "file" }
 *
 * Auth (either):
 *   - `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (used by pg_cron)
 *   - `x-brain-key: <BRAIN_ACCESS_KEY>` (manual invocation)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";

// --- Environment ---

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const BRAIN_ACCESS_KEY = Deno.env.get("BRAIN_ACCESS_KEY") || "";
const GRAPH_USER_ID = Deno.env.get("GRAPH_USER_ID")!;

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Types ---

type SourceKey = "mail" | "event" | "onenote" | "file";

interface SourceResult {
  pulled: number;
  saved: number;
  skipped: number;
  error?: string;
}

interface ClassifierResult {
  save: boolean;
  summary: string;
  topics: string[];
  action_items: string[];
}

// --- Auth ---

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

// --- AI helpers ---

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

function buildClassifierPrompt(): string {
  return [
    "You decide if a Microsoft 365 item is worth saving to a personal knowledge base.",
    "Save it ONLY if it contains:",
    "- decisions, commitments, deadlines, action items",
    "- new information the user should remember (people, projects, links)",
    "- meeting notes, summaries, important threads",
    "SKIP if it's: newsletters, automated notifications, calendar invites with no body,",
    "out-of-office, marketing, FYI/CC threads with no action.",
    'Reply JSON: { "save": bool, "summary": "≤300 chars", "topics": [...], "action_items": [...] }',
  ].join("\n");
}

async function classifyForSaving(
  item: Record<string, unknown>,
): Promise<ClassifierResult> {
  // Defensive truncation — keep token cost bounded regardless of caller.
  const trimmed = { ...item };
  if (typeof trimmed.body_preview === "string") {
    trimmed.body_preview = (trimmed.body_preview as string).slice(0, 2000);
  }

  try {
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
          { role: "system", content: buildClassifierPrompt() },
          { role: "user", content: JSON.stringify(trimmed) },
        ],
      }),
    });
    if (!r.ok) {
      const msg = await r.text().catch(() => "");
      console.error(`[graph-ingest] classifier failed: ${r.status} ${msg}`);
      return { save: false, summary: "", topics: [], action_items: [] };
    }
    const d = await r.json();
    const parsed = JSON.parse(d.choices[0].message.content);
    return {
      save: Boolean(parsed.save),
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 300) : "",
      topics: Array.isArray(parsed.topics) ? parsed.topics.map(String) : [],
      action_items: Array.isArray(parsed.action_items)
        ? parsed.action_items.map(String)
        : [],
    };
  } catch (err) {
    console.error(`[graph-ingest] classifier exception:`, err);
    return { save: false, summary: "", topics: [], action_items: [] };
  }
}

// --- State ---

async function getState(source: SourceKey): Promise<Date> {
  const { data, error } = await supabase
    .from("graph_ingest_state")
    .select("last_ingested_at")
    .eq("source", source)
    .maybeSingle();
  if (error) {
    console.error(`[graph-ingest][${source}] getState error`, error);
  }
  if (data?.last_ingested_at) {
    return new Date(data.last_ingested_at);
  }
  // Default to 24h ago on first run.
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

async function updateState(source: SourceKey, timestamp: Date): Promise<void> {
  const { error } = await supabase
    .from("graph_ingest_state")
    .upsert(
      {
        source,
        last_ingested_at: timestamp.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source" },
    );
  if (error) {
    console.error(`[graph-ingest][${source}] updateState error`, error);
  }
}

async function alreadyIngested(sourceMessageId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("thoughts")
    .select("id")
    .eq("source_message_id", sourceMessageId)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[graph-ingest] alreadyIngested error`, error);
    return false;
  }
  return Boolean(data);
}

async function insertThought(
  content: string,
  metadata: Record<string, unknown>,
  embedding: number[],
  sourceMessageId: string,
): Promise<void> {
  const { error } = await supabase.from("thoughts").insert({
    content,
    metadata,
    embedding,
    source_message_id: sourceMessageId,
    status: "open",
  });
  if (error) {
    console.error(`[graph-ingest] insertThought error`, error);
    throw error;
  }
}

// --- Graph fetch helper ---

interface GraphPage<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

async function graphGet<T = unknown>(
  url: string,
  token: string,
  extraHeaders: Record<string, string> = {},
): Promise<GraphPage<T> | null> {
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...extraHeaders,
    },
  });
  if (r.status === 429) {
    console.warn(`[graph-ingest] 429 rate limited on ${url}`);
    return null;
  }
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    console.error(`[graph-ingest] Graph GET ${r.status} ${url}: ${msg}`);
    return null;
  }
  return (await r.json()) as GraphPage<T>;
}

// --- Source pullers ---

async function pullMail(
  token: string,
  userId: string,
  since: Date,
): Promise<SourceResult> {
  const result: SourceResult = { pulled: 0, saved: 0, skipped: 0 };
  const baseUrl =
    `${GRAPH_BASE}/users/${encodeURIComponent(userId)}/mailFolders/Inbox/messages` +
    `?$filter=${encodeURIComponent(`receivedDateTime ge ${since.toISOString()}`)}` +
    `&$top=50` +
    `&$orderby=${encodeURIComponent("receivedDateTime asc")}` +
    `&$select=${encodeURIComponent(
      "id,subject,bodyPreview,from,receivedDateTime,webLink,importance,flag",
    )}`;

  let url: string | undefined = baseUrl;
  let pages = 0;
  let maxSeen: Date | null = null;

  while (url && pages < 5) {
    const page: GraphPage<Record<string, any>> | null = await graphGet(url, token);
    if (!page) break;
    pages++;

    for (const msg of page.value || []) {
      result.pulled++;
      const sourceMessageId = `graph-mail:${msg.id}`;

      if (await alreadyIngested(sourceMessageId)) {
        result.skipped++;
        continue;
      }

      const fromAddr = msg.from?.emailAddress || {};
      const receivedAt = msg.receivedDateTime as string | undefined;
      if (receivedAt) {
        const d = new Date(receivedAt);
        if (!maxSeen || d > maxSeen) maxSeen = d;
      }

      const classifierInput = {
        type: "mail",
        subject: msg.subject || "",
        from: fromAddr,
        body_preview: msg.bodyPreview || "",
        importance: msg.importance,
        flagged: msg.flag?.flagStatus === "flagged",
        received_at: receivedAt,
      };

      const classifier = await classifyForSaving(classifierInput);
      if (!classifier.save || !classifier.summary) {
        result.skipped++;
        continue;
      }

      try {
        const embedding = await getEmbedding(classifier.summary);
        const metadata = {
          source: "graph-mail",
          type: "email",
          subject: msg.subject || "",
          sender: fromAddr.address || "",
          sender_name: fromAddr.name || "",
          received_at: receivedAt,
          original_url: msg.webLink || "",
          importance: msg.importance,
          topics: classifier.topics,
          action_items: classifier.action_items,
        };
        await insertThought(classifier.summary, metadata, embedding, sourceMessageId);
        result.saved++;
        console.log(
          `[graph-ingest][mail] saved: ${msg.subject || "(no subject)"}`,
        );
      } catch (err) {
        console.error(`[graph-ingest][mail] insert failed:`, err);
        result.skipped++;
      }
    }

    url = page["@odata.nextLink"];
  }

  if (maxSeen) await updateState("mail", maxSeen);
  console.log(
    `[graph-ingest][mail] done: pulled=${result.pulled} saved=${result.saved} skipped=${result.skipped}`,
  );
  return result;
}

async function pullCalendar(
  token: string,
  userId: string,
  _since: Date,
): Promise<SourceResult> {
  const result: SourceResult = { pulled: 0, saved: 0, skipped: 0 };
  const now = new Date();
  const startWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const endWindow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const url =
    `${GRAPH_BASE}/users/${encodeURIComponent(userId)}/calendarView` +
    `?startDateTime=${encodeURIComponent(startWindow.toISOString())}` +
    `&endDateTime=${encodeURIComponent(endWindow.toISOString())}` +
    `&$top=50` +
    `&$select=${encodeURIComponent(
      "id,subject,start,end,attendees,bodyPreview,organizer,webLink,location,isAllDay",
    )}`;

  const page = await graphGet<Record<string, any>>(url, token, {
    Prefer: 'outlook.timezone="UTC"',
  });
  if (!page) return result;

  let maxSeen: Date | null = null;

  for (const ev of page.value || []) {
    result.pulled++;
    const sourceMessageId = `graph-event:${ev.id}`;
    if (await alreadyIngested(sourceMessageId)) {
      result.skipped++;
      continue;
    }

    const startDt = ev.start?.dateTime as string | undefined;
    if (startDt) {
      const d = new Date(startDt + (startDt.endsWith("Z") ? "" : "Z"));
      if (!isNaN(d.getTime()) && (!maxSeen || d > maxSeen)) maxSeen = d;
    }

    const attendees: any[] = Array.isArray(ev.attendees) ? ev.attendees : [];
    const organizerAddr = ev.organizer?.emailAddress || {};
    const bodyPreview = (ev.bodyPreview || "").trim();

    const classifierInput = {
      type: "event",
      subject: ev.subject || "",
      organizer: organizerAddr,
      attendee_count: attendees.length,
      body_preview: bodyPreview,
      start: ev.start,
      end: ev.end,
      location: ev.location?.displayName || "",
    };

    const classifier = await classifyForSaving(classifierInput);

    // Override: events with body OR >2 attendees are saved regardless of classifier.
    const forceSave = bodyPreview.length > 0 || attendees.length > 2;
    const shouldSave = classifier.save || forceSave;

    if (!shouldSave) {
      result.skipped++;
      continue;
    }

    // Build content: prefer classifier summary, else fall back to subject + body preview.
    let content = classifier.summary;
    if (!content) {
      const fallback = bodyPreview ? `${ev.subject}: ${bodyPreview}` : ev.subject;
      content = (fallback || "").slice(0, 300);
    }
    if (!content) {
      result.skipped++;
      continue;
    }

    try {
      const embedding = await getEmbedding(content);
      const metadata = {
        source: "graph-event",
        type: "calendar_event",
        subject: ev.subject || "",
        start: startDt,
        end: ev.end?.dateTime,
        location: ev.location?.displayName || "",
        organizer: organizerAddr.address || "",
        attendees: attendees
          .map((a) => a?.emailAddress?.address)
          .filter(Boolean),
        original_url: ev.webLink || "",
        topics: classifier.topics,
        action_items: classifier.action_items,
      };
      await insertThought(content, metadata, embedding, sourceMessageId);
      result.saved++;
      console.log(`[graph-ingest][event] saved: ${ev.subject || "(no subject)"}`);
    } catch (err) {
      console.error(`[graph-ingest][event] insert failed:`, err);
      result.skipped++;
    }
  }

  if (maxSeen) await updateState("event", maxSeen);
  console.log(
    `[graph-ingest][event] done: pulled=${result.pulled} saved=${result.saved} skipped=${result.skipped}`,
  );
  return result;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function pullOneNote(
  token: string,
  userId: string,
  since: Date,
): Promise<SourceResult> {
  const result: SourceResult = { pulled: 0, saved: 0, skipped: 0 };
  const url =
    `${GRAPH_BASE}/users/${encodeURIComponent(userId)}/onenote/pages` +
    `?$filter=${encodeURIComponent(`lastModifiedDateTime ge ${since.toISOString()}`)}` +
    `&$top=25` +
    `&$orderby=${encodeURIComponent("lastModifiedDateTime asc")}` +
    `&$select=${encodeURIComponent(
      "id,title,createdDateTime,lastModifiedDateTime,links,parentSection",
    )}`;

  const page = await graphGet<Record<string, any>>(url, token);
  if (!page) return result;

  let maxSeen: Date | null = null;

  for (const p of page.value || []) {
    result.pulled++;
    const sourceMessageId = `graph-onenote:${p.id}`;
    if (await alreadyIngested(sourceMessageId)) {
      result.skipped++;
      continue;
    }

    const lastMod = p.lastModifiedDateTime as string | undefined;
    if (lastMod) {
      const d = new Date(lastMod);
      if (!maxSeen || d > maxSeen) maxSeen = d;
    }

    // Fetch page HTML content for context.
    let stripped = "";
    try {
      const contentUrl = `${GRAPH_BASE}/users/${encodeURIComponent(userId)}/onenote/pages/${p.id}/content`;
      const r = await fetch(contentUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const html = await r.text();
        stripped = stripHtml(html).slice(0, 4000);
      } else if (r.status === 429) {
        console.warn(`[graph-ingest][onenote] 429 fetching page content`);
      } else {
        console.error(
          `[graph-ingest][onenote] page content ${r.status} for ${p.id}`,
        );
      }
    } catch (err) {
      console.error(`[graph-ingest][onenote] content fetch failed:`, err);
    }

    const classifierInput = {
      type: "onenote",
      title: p.title || "",
      body_preview: stripped,
      last_modified: lastMod,
      section_name: p.parentSection?.displayName || "",
    };

    const classifier = await classifyForSaving(classifierInput);
    if (!classifier.save || !classifier.summary) {
      result.skipped++;
      continue;
    }

    try {
      const embedding = await getEmbedding(classifier.summary);
      const metadata = {
        source: "graph-onenote",
        type: "onenote_page",
        title: p.title || "",
        section: p.parentSection?.displayName || "",
        modified_at: lastMod,
        original_url: p.links?.oneNoteWebUrl?.href || "",
        topics: classifier.topics,
        action_items: classifier.action_items,
      };
      await insertThought(classifier.summary, metadata, embedding, sourceMessageId);
      result.saved++;
      console.log(`[graph-ingest][onenote] saved: ${p.title || "(no title)"}`);
    } catch (err) {
      console.error(`[graph-ingest][onenote] insert failed:`, err);
      result.skipped++;
    }
  }

  if (maxSeen) await updateState("onenote", maxSeen);
  console.log(
    `[graph-ingest][onenote] done: pulled=${result.pulled} saved=${result.saved} skipped=${result.skipped}`,
  );
  return result;
}

const ALLOWED_FILE_EXTS = new Set([
  "doc",
  "docx",
  "xlsx",
  "pptx",
  "pdf",
  "md",
  "txt",
  "loop",
  "fluid",
]);

function fileExt(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

async function pullFiles(
  token: string,
  userId: string,
  since: Date,
): Promise<SourceResult> {
  const result: SourceResult = { pulled: 0, saved: 0, skipped: 0 };
  const url = `${GRAPH_BASE}/users/${encodeURIComponent(userId)}/drive/recent?$top=25`;

  const page = await graphGet<Record<string, any>>(url, token);
  if (!page) return result;

  let maxSeen: Date | null = null;

  for (const item of page.value || []) {
    const name = item.name || "";
    const ext = fileExt(name);
    const lastMod = item.lastModifiedDateTime as string | undefined;

    // Client-side filtering: extension allowlist + since cutoff.
    if (!ALLOWED_FILE_EXTS.has(ext)) continue;
    if (!lastMod || new Date(lastMod) < since) continue;

    result.pulled++;
    const sourceMessageId = `graph-file:${item.id}`;
    if (await alreadyIngested(sourceMessageId)) {
      result.skipped++;
      continue;
    }

    const d = new Date(lastMod);
    if (!maxSeen || d > maxSeen) maxSeen = d;

    const modifiedBy = item.lastModifiedBy?.user?.displayName || "";

    const classifierInput = {
      type: "file",
      name,
      body_preview: "file metadata only",
      modified_at: lastMod,
      file_type: ext,
      modified_by: modifiedBy,
    };

    const classifier = await classifyForSaving(classifierInput);
    if (!classifier.save || !classifier.summary) {
      result.skipped++;
      continue;
    }

    try {
      const embedding = await getEmbedding(classifier.summary);
      const metadata = {
        source: "graph-file",
        type: "document",
        name,
        file_type: ext,
        modified_at: lastMod,
        modified_by: modifiedBy,
        original_url: item.webUrl || "",
        topics: classifier.topics,
        action_items: [] as string[],
      };
      await insertThought(classifier.summary, metadata, embedding, sourceMessageId);
      result.saved++;
      console.log(`[graph-ingest][file] saved: ${name}`);
    } catch (err) {
      console.error(`[graph-ingest][file] insert failed:`, err);
      result.skipped++;
    }
  }

  if (maxSeen) await updateState("file", maxSeen);
  console.log(
    `[graph-ingest][file] done: pulled=${result.pulled} saved=${result.saved} skipped=${result.skipped}`,
  );
  return result;
}

// --- Auth check ---

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token && token === SUPABASE_SERVICE_ROLE_KEY) return true;
  }
  const brainKey = req.headers.get("x-brain-key") || "";
  if (BRAIN_ACCESS_KEY && brainKey === BRAIN_ACCESS_KEY) return true;
  return false;
}

// --- Handler ---

const app = new Hono();

app.post("*", async (c) => {
  if (!isAuthorized(c.req.raw)) {
    return c.json({ success: false, error: "unauthorized" }, 401);
  }

  let body: { source?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const requested = (body.source || "all").toLowerCase();
  const valid = new Set(["all", "mail", "event", "onenote", "file"]);
  if (!valid.has(requested)) {
    return c.json(
      { success: false, error: `invalid source: ${requested}` },
      400,
    );
  }

  const token = await getGraphToken();
  if (!token) {
    return c.json(
      { success: false, error: "failed to obtain Graph token" },
      500,
    );
  }

  const userId = GRAPH_USER_ID;
  if (!userId) {
    return c.json({ success: false, error: "GRAPH_USER_ID not set" }, 500);
  }

  const wrap = async (
    key: SourceKey,
    fn: () => Promise<SourceResult>,
  ): Promise<[SourceKey, SourceResult]> => {
    try {
      const since = await getState(key);
      console.log(`[graph-ingest][${key}] since=${since.toISOString()}`);
      const r = await fn();
      return [key, r];
    } catch (err) {
      console.error(`[graph-ingest][${key}] fatal:`, err);
      return [
        key,
        { pulled: 0, saved: 0, skipped: 0, error: String(err) },
      ];
    }
  };

  const tasks: Array<Promise<[SourceKey, SourceResult]>> = [];

  if (requested === "all" || requested === "mail") {
    tasks.push(
      wrap("mail", async () => pullMail(token, userId, await getState("mail"))),
    );
  }
  if (requested === "all" || requested === "event") {
    tasks.push(
      wrap("event", async () =>
        pullCalendar(token, userId, await getState("event")),
      ),
    );
  }
  if (requested === "all" || requested === "onenote") {
    tasks.push(
      wrap("onenote", async () =>
        pullOneNote(token, userId, await getState("onenote")),
      ),
    );
  }
  if (requested === "all" || requested === "file") {
    tasks.push(
      wrap("file", async () => pullFiles(token, userId, await getState("file"))),
    );
  }

  const settled = await Promise.all(tasks);
  const results: Record<string, SourceResult> = {};
  for (const [key, r] of settled) results[key] = r;

  return c.json({ success: true, results });
});

Deno.serve(app.fetch);
