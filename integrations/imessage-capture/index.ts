import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";

// --- Environment ---

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const BLUEBUBBLES_URL = Deno.env.get("BLUEBUBBLES_URL")!; // https://bb.yourdomain.com
const BLUEBUBBLES_PASSWORD = Deno.env.get("BLUEBUBBLES_PASSWORD")!; // URL-decoded password
const ALLOWED_CHAT_GUIDS = Deno.env.get("BLUEBUBBLES_ALLOWED_CHATS") || ""; // comma-separated chat GUIDs

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Bot reply prefixes — messages starting with these are our own replies (loop prevention)
const BOT_PREFIXES = [
  "\u200B", // zero-width space (invisible prefix on all bot replies)
  "✅",
  "🔍",
  "📊",
  "❌",
  "🧠",
  "⏰",
  "🗑️",
  "🔄",
  "📋",
  "📎",
  "💡",
];

const app = new Hono();

// --- BlueBubbles API helpers ---

function bbApiUrl(path: string): string {
  const pw = encodeURIComponent(BLUEBUBBLES_PASSWORD);
  const base = BLUEBUBBLES_URL.replace(/\/+$/, "");
  return `${base}${path}?guid=${pw}`;
}

async function sendReply(chatGuid: string, text: string): Promise<void> {
  // Prefix all bot replies with zero-width space for loop detection
  const prefixed = `\u200B${text}`;
  const tempGuid = `cerebro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const r = await fetch(bbApiUrl("/api/v1/message/text"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatGuid,
        message: prefixed,
        method: "apple-script",
        tempGuid,
      }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error(`BB send failed (${r.status}):`, errText);
    }
  } catch (err) {
    console.error("BB send error:", err);
  }
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
  const centralStr = now.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return `You are a metadata extractor for a personal knowledge base.
Current datetime (Central US): ${centralStr}

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
- reminder_datetime: local datetime WITHOUT timezone offset, e.g. "2025-07-19T15:00:00". All times are Central US. Default time 09:00 if not specified.
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

function parseLocalDatetime(datetime: string): { start: string; end: string } {
  const local = datetime.replace(/(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/, "");
  const parts = local.match(
    /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):?(\d{2})?/,
  );
  if (!parts) return { start: datetime, end: datetime };
  const [, yr, mo, dy, hr, mn, sc] = parts;
  const start = `${yr}-${mo}-${dy}T${hr}:${mn}:${sc || "00"}`;
  const d = new Date(
    Number(yr),
    Number(mo) - 1,
    Number(dy),
    Number(hr),
    Number(mn),
    Number(sc || 0),
  );
  d.setMinutes(d.getMinutes() + 30);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const end = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return { start, end };
}

async function createO365Event(
  title: string,
  datetime: string,
  body: string,
): Promise<boolean> {
  const userEmail = Deno.env.get("CALENDAR_USER_EMAIL");
  const token = await getGraphToken();
  if (!token || !userEmail) return false;
  const { start, end } = parseLocalDatetime(datetime);
  const r = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userEmail}/calendar/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: title,
        body: { contentType: "Text", content: body },
        start: { dateTime: start, timeZone: "America/Chicago" },
        end: { dateTime: end, timeZone: "America/Chicago" },
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
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const claim = btoa(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/calendar",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const signingInput = `${header}.${claim}`;
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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

async function createGoogleEvent(
  title: string,
  datetime: string,
  body: string,
): Promise<boolean> {
  const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID");
  const token = await getGoogleAccessToken();
  if (!token || !calendarId) return false;
  const { start, end } = parseLocalDatetime(datetime);
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title,
        description: body,
        start: { dateTime: start, timeZone: "America/Chicago" },
        end: { dateTime: end, timeZone: "America/Chicago" },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 15 }],
        },
      }),
    },
  );
  return r.ok;
}

async function createCalendarReminders(
  metadata: Record<string, unknown>,
  content: string,
): Promise<string[]> {
  if (!metadata.has_reminder || !metadata.reminder_datetime) return [];
  const title = (metadata.reminder_title as string) || "Cerebro Reminder";
  const datetime = metadata.reminder_datetime as string;
  const created: string[] = [];
  const [o365, google] = await Promise.all([
    createO365Event(title, datetime, content).catch(() => false),
    createGoogleEvent(title, datetime, content).catch(() => false),
  ]);
  if (o365) created.push("Office 365");
  if (google) created.push("Google Calendar");
  return created;
}

// --- Task Command Detection & Handling ---

function parseTaskCommand(
  text: string,
): { action: "complete" | "reopen" | "delete"; description: string } | null {
  const lower = text.toLowerCase().trim();

  const completePrefixes = [
    "done:", "done ",
    "completed:", "completed ",
    "finished:", "finished ",
    "complete:", "complete ",
    "shipped:", "shipped ",
    "closed:", "closed ",
  ];
  for (const prefix of completePrefixes) {
    if (lower.startsWith(prefix)) {
      return { action: "complete", description: text.slice(prefix.length).trim() };
    }
  }

  const reopenPrefixes = [
    "reopen:", "reopen ",
    "undo:", "undo ",
    "not done:", "not done ",
    "re-open:", "re-open ",
    "undone:", "undone ",
  ];
  for (const prefix of reopenPrefixes) {
    if (lower.startsWith(prefix)) {
      return { action: "reopen", description: text.slice(prefix.length).trim() };
    }
  }

  const deletePrefixes = ["delete:", "delete ", "remove:", "remove ", "trash:", "trash "];
  for (const prefix of deletePrefixes) {
    if (lower.startsWith(prefix)) {
      return { action: "delete", description: text.slice(prefix.length).trim() };
    }
  }

  return null;
}

async function handleTaskCommand(
  action: "complete" | "reopen" | "delete",
  description: string,
  chatGuid: string,
): Promise<void> {
  if (!description) {
    await sendReply(
      chatGuid,
      `Please describe the task. Example: "${action}: quarterly report"`,
    );
    return;
  }

  const embedding = await getEmbedding(description);
  const { data: results } = await supabase.rpc("match_thoughts", {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: 5,
    filter: {},
  });

  if (!results || results.length === 0) {
    await sendReply(chatGuid, `No matching thought found for "${description}".`);
    return;
  }

  for (const r of results) {
    const { data: thought } = await supabase
      .from("thoughts")
      .select("id, content, metadata, status")
      .eq("id", r.id)
      .single();

    if (!thought) continue;
    const meta = (thought.metadata || {}) as Record<string, unknown>;
    const title = (meta.title as string) || thought.content.slice(0, 60);
    const similarity = (r.similarity * 100).toFixed(0);

    if (
      action === "complete" &&
      meta.type === "task" &&
      thought.status !== "done" &&
      thought.status !== "deleted"
    ) {
      await supabase.from("thoughts").update({ status: "done" }).eq("id", thought.id);
      await sendReply(chatGuid, `✅ Marked done: ${title}\n(${similarity}% match)`);
      return;
    }

    if (action === "reopen" && meta.type === "task" && thought.status === "done") {
      await supabase.from("thoughts").update({ status: "open" }).eq("id", thought.id);
      await sendReply(chatGuid, `🔄 Reopened: ${title}\n(${similarity}% match)`);
      return;
    }

    if (action === "delete" && thought.status !== "deleted") {
      await supabase.from("thoughts").update({ status: "deleted" }).eq("id", thought.id);
      await sendReply(chatGuid, `🗑️ Deleted: ${title}\n(${similarity}% match)`);
      return;
    }
  }

  const actionLabels = {
    complete: "open task",
    reopen: "completed task",
    delete: "thought",
  };
  await sendReply(
    chatGuid,
    `No matching ${actionLabels[action]} found for "${description}".`,
  );
}

// --- File Attachment Helpers ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function mimeFromExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    txt: "text/plain",
    csv: "text/csv",
  };
  return map[ext] || "application/octet-stream";
}

async function analyzeFileWithVision(
  base64Data: string,
  contentType: string,
  fileName: string,
): Promise<{ description: string; fileType: string }> {
  // Text/CSV: decode and return directly
  if (contentType.startsWith("text/") || contentType === "text/csv") {
    try {
      const decoded = atob(base64Data);
      const preview = decoded.slice(0, 3000);
      return {
        description: `[Text file: ${fileName}]\n${preview}${decoded.length > 3000 ? "\n...(truncated)" : ""}`,
        fileType: "text",
      };
    } catch {
      return {
        description: `[Text file: ${fileName}] — could not decode contents.`,
        fileType: "text",
      };
    }
  }

  // PDF: use Gemini native file input
  if (contentType === "application/pdf") {
    try {
      console.log(`PDF analysis: ${fileName}, base64 len: ${base64Data.length}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      const r = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          max_tokens: 2000,
          temperature: 0.2,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this PDF document (${fileName}). Extract and summarize all text content. Include key details, numbers, names, and important information.`,
                },
                {
                  type: "file",
                  file: {
                    filename: fileName,
                    file_data: `data:application/pdf;base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
        }),
      });
      clearTimeout(timeout);
      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        console.error("PDF analysis error:", errText);
        return {
          description: `[PDF: ${fileName}] — analysis failed (${r.status}).`,
          fileType: "pdf",
        };
      }
      const d = await r.json();
      return {
        description:
          d.choices?.[0]?.message?.content ||
          `[PDF: ${fileName}] — analysis unavailable.`,
        fileType: "pdf",
      };
    } catch (err) {
      console.error("PDF analysis error:", err);
      return {
        description: `[PDF: ${fileName}] — could not analyze (${(err as Error).message}).`,
        fileType: "pdf",
      };
    }
  }

  // DOCX/DOC: use Gemini native document input
  if (
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    contentType === "application/msword"
  ) {
    try {
      const r = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          max_tokens: 2000,
          temperature: 0.2,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this Word document (${fileName}). Extract and summarize all text content.`,
                },
                {
                  type: "file",
                  file: {
                    filename: fileName,
                    file_data: `data:${contentType};base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
        }),
      });
      if (!r.ok) {
        return {
          description: `[Document: ${fileName}] — analysis failed.`,
          fileType: "document",
        };
      }
      const d = await r.json();
      return {
        description:
          d.choices?.[0]?.message?.content || `[Document: ${fileName}]`,
        fileType: "document",
      };
    } catch {
      return {
        description: `[Document: ${fileName}] — could not analyze.`,
        fileType: "document",
      };
    }
  }

  // Images: GPT-4o-mini vision
  if (contentType.startsWith("image/")) {
    try {
      const r = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          max_tokens: 2000,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You are analyzing a file for a personal knowledge base. Describe the contents in detail. If there is text, transcribe it.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this image (${fileName}). Describe what you see in detail. If there is text, transcribe all of it.`,
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${contentType};base64,${base64Data}` },
                },
              ],
            },
          ],
        }),
      });
      if (!r.ok) {
        return {
          description: `[Image: ${fileName}] — vision analysis failed.`,
          fileType: "image",
        };
      }
      const d = await r.json();
      return {
        description:
          d.choices?.[0]?.message?.content ||
          `[Image: ${fileName}] — analysis unavailable.`,
        fileType: "image",
      };
    } catch {
      return {
        description: `[Image: ${fileName}] — could not analyze.`,
        fileType: "image",
      };
    }
  }

  return {
    description: `[File: ${fileName}] (${contentType}) — content analysis not supported for this file type.`,
    fileType: "file",
  };
}

async function uploadToStorage(
  buffer: ArrayBuffer,
  filename: string,
  contentType: string,
): Promise<{ url: string | null; path: string | null }> {
  const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `imessage/${Date.now()}_${sanitizedName}`;
  const { error } = await supabase.storage
    .from("cerebro-files")
    .upload(path, buffer, { contentType, upsert: false });
  if (error) {
    console.error("Storage upload error:", error);
    return { url: null, path: null };
  }
  const { data: urlData } = await supabase.storage
    .from("cerebro-files")
    .createSignedUrl(path, 365 * 24 * 60 * 60);
  return { url: urlData?.signedUrl || null, path };
}

// --- Download attachment from BlueBubbles ---

async function downloadBBAttachment(
  attachmentGuid: string,
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const r = await fetch(
      bbApiUrl(`/api/v1/attachment/${encodeURIComponent(attachmentGuid)}/download`),
    );
    if (!r.ok) {
      console.error(`BB attachment download failed: ${r.status}`);
      return null;
    }
    const buffer = await r.arrayBuffer();
    const contentType = r.headers.get("content-type") || "application/octet-stream";
    return { buffer, contentType };
  } catch (err) {
    console.error("BB attachment download error:", err);
    return null;
  }
}

// --- Main webhook handler ---

app.post("*", async (c) => {
  try {
    const body = await c.req.json();

    // BlueBubbles webhook event types: new-message, updated-message, etc.
    if (body.type !== "new-message") {
      return c.json({ status: "ok" });
    }

    const message = body.data;
    if (!message) {
      return c.json({ status: "ok" });
    }

    const text: string = (message.text || "").trim();
    const chatGuid: string = message.chats?.[0]?.guid || "";
    const senderHandle: string = message.handle?.address || "";
    const isFromMe: boolean = message.isFromMe || false;

    console.log(
      `iMessage webhook: chat=${chatGuid}, from=${senderHandle}, isFromMe=${isFromMe}, text="${text.slice(0, 80)}"`,
    );

    // Skip empty messages (could be reactions, typing indicators, etc.)
    if (!text && (!message.attachments || message.attachments.length === 0)) {
      return c.json({ status: "ok" });
    }

    // Loop prevention: skip messages that start with bot prefixes
    if (text && BOT_PREFIXES.some((p) => text.startsWith(p))) {
      console.log("Skipping bot reply (prefix match)");
      return c.json({ status: "ok" });
    }

    // Filter by allowed chat GUIDs if configured
    if (ALLOWED_CHAT_GUIDS) {
      const allowed = ALLOWED_CHAT_GUIDS.split(",").map((g) => g.trim());
      if (allowed.length > 0 && !allowed.includes(chatGuid)) {
        console.log(`Skipping message from non-allowed chat: ${chatGuid}`);
        return c.json({ status: "ok" });
      }
    }

    // --- Help command ---
    const lowerText = text.toLowerCase().trim();
    if (lowerText === "help" || lowerText === "commands" || lowerText === "?") {
      await sendReply(
        chatGuid,
        `🧠 Cerebro Commands\n\n` +
          `Capture: Just type your thought!\n` +
          `Search: search <query>\n` +
          `Stats: stats\n` +
          `Complete task: done <description>\n` +
          `Reopen task: reopen <description>\n` +
          `Delete: delete <description>\n` +
          `Help: help\n\n` +
          `You can also send files (images, PDFs, docs) to scan and store.`,
      );
      return c.json({ status: "ok" });
    }

    // --- Stats command ---
    if (
      lowerText === "stats" ||
      lowerText === "statistics" ||
      lowerText.startsWith("stats")
    ) {
      try {
        const { count: total } = await supabase
          .from("thoughts")
          .select("*", { count: "exact", head: true })
          .neq("status", "deleted");
        const { count: openCount } = await supabase
          .from("thoughts")
          .select("*", { count: "exact", head: true })
          .eq("status", "open")
          .neq("status", "deleted");
        const { count: doneCount } = await supabase
          .from("thoughts")
          .select("*", { count: "exact", head: true })
          .eq("status", "done");
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
        const { count: thisWeek } = await supabase
          .from("thoughts")
          .select("*", { count: "exact", head: true })
          .gte("created_at", weekAgo)
          .neq("status", "deleted");
        await sendReply(
          chatGuid,
          `📊 Cerebro Stats\n\n` +
            `Total thoughts: ${total}\n` +
            `Open: ${openCount}\n` +
            `Completed: ${doneCount}\n` +
            `This week: ${thisWeek}`,
        );
      } catch (err) {
        await sendReply(chatGuid, `❌ Stats failed: ${err}`);
      }
      return c.json({ status: "ok" });
    }

    // --- Task commands (done:, reopen:, delete:) ---
    if (text) {
      const taskCmd = parseTaskCommand(text);
      if (taskCmd) {
        await handleTaskCommand(taskCmd.action, taskCmd.description, chatGuid);
        return c.json({ status: "ok" });
      }
    }

    // --- Search command ---
    if (
      lowerText.startsWith("search:") ||
      lowerText.startsWith("search ") ||
      lowerText.startsWith("find:") ||
      lowerText.startsWith("find ")
    ) {
      const query = text.replace(/^(search|find)[:\s]+/i, "").trim();
      if (!query) {
        await sendReply(
          chatGuid,
          "What would you like to search for? Try: search:azure setup",
        );
        return c.json({ status: "ok" });
      }
      try {
        const queryEmbedding = await getEmbedding(query);
        const { data: results, error: searchErr } = await supabase.rpc(
          "match_thoughts",
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.3,
            match_count: 5,
          },
        );
        if (searchErr) throw searchErr;
        if (!results || results.length === 0) {
          await sendReply(chatGuid, `🔍 No results found for "${query}".`);
        } else {
          const lines = results.map(
            (
              r: { content: string; similarity: number; created_at: string },
              i: number,
            ) => {
              const date = new Date(r.created_at).toLocaleDateString();
              const score = (r.similarity * 100).toFixed(0);
              const preview =
                r.content.length > 120
                  ? r.content.slice(0, 120) + "…"
                  : r.content;
              return `${i + 1}. (${score}%, ${date})\n${preview}`;
            },
          );
          await sendReply(
            chatGuid,
            `🔍 ${results.length} result(s) for "${query}":\n\n${lines.join("\n\n")}`,
          );
        }
      } catch (err) {
        console.error("Search error:", err);
        await sendReply(chatGuid, `❌ Search failed: ${err}`);
      }
      return c.json({ status: "ok" });
    }

    // --- File attachment handling ---
    const attachments = message.attachments || [];
    let fileDescription = "";
    let fileUrl: string | null = null;
    let fileType: string | null = null;
    let fileName = "";

    if (attachments.length > 0) {
      const att = attachments[0];
      fileName = att.transferName || att.filename || "unknown_file";
      const attGuid = att.guid;

      if (attGuid) {
        try {
          const downloaded = await downloadBBAttachment(attGuid);
          if (downloaded) {
            let contentType = downloaded.contentType;
            // BlueBubbles may return generic content types — infer from extension
            if (
              contentType === "application/octet-stream" ||
              !contentType
            ) {
              contentType = mimeFromExtension(fileName);
            }

            const base64 = arrayBufferToBase64(downloaded.buffer);
            const analysis = await analyzeFileWithVision(
              base64,
              contentType,
              fileName,
            );
            fileDescription = analysis.description;
            fileType = analysis.fileType;

            // Upload to storage
            const uploaded = await uploadToStorage(
              downloaded.buffer,
              fileName,
              contentType,
            );
            fileUrl = uploaded.url;
          }
        } catch (err) {
          console.error("File processing error:", err);
          fileDescription = `[File: ${fileName}] — processing failed.`;
        }
      }
    }

    // Build the content to embed
    const combinedContent = fileDescription
      ? text
        ? `${text}\n\n[Attached: ${fileName}]\n${fileDescription}`
        : `[Attached: ${fileName}]\n${fileDescription}`
      : text;

    if (!combinedContent) {
      return c.json({ status: "ok" });
    }

    // --- Capture thought ---
    const [embedding, metadata] = await Promise.all([
      getEmbedding(combinedContent),
      extractMetadata(combinedContent),
    ]);

    const meta = metadata as Record<string, unknown>;
    const insertData: Record<string, unknown> = {
      content: combinedContent,
      embedding,
      metadata: {
        ...meta,
        source: "imessage",
        imessage_chat_guid: chatGuid,
        imessage_sender: senderHandle || "self",
        ...(fileDescription
          ? {
              has_file: true,
              file_name: fileName,
              file_description: fileDescription.slice(0, 500),
            }
          : {}),
      },
    };

    if (fileUrl) insertData.file_url = fileUrl;
    if (fileType) insertData.file_type = fileType;

    const { error } = await supabase.from("thoughts").insert(insertData);

    if (error) {
      console.error("Supabase insert error:", error);
      await sendReply(chatGuid, `❌ Failed to capture: ${error.message}`);
      return c.json({ status: "ok" });
    }

    // Build confirmation
    let confirmation = `✅ Captured as ${meta.type || "thought"}`;
    if (Array.isArray(meta.topics) && meta.topics.length) {
      confirmation += ` — ${(meta.topics as string[]).join(", ")}`;
    }
    if (Array.isArray(meta.people) && meta.people.length) {
      confirmation += `\nPeople: ${(meta.people as string[]).join(", ")}`;
    }
    if (Array.isArray(meta.action_items) && meta.action_items.length) {
      confirmation += `\nActions: ${(meta.action_items as string[]).join("; ")}`;
    }
    if (fileDescription) {
      confirmation += `\n📎 File: ${fileName}`;
    }

    // Create calendar reminders if detected
    const calendars = await createCalendarReminders(meta, combinedContent);
    if (calendars.length) {
      confirmation += `\n⏰ Reminder created on ${calendars.join(" + ")}`;
    } else if (meta.has_reminder) {
      confirmation += `\n⏰ Reminder detected but no calendar configured`;
    }

    await sendReply(chatGuid, confirmation);

    // Register chat for daily digest delivery
    await supabase
      .from("digest_channels")
      .upsert(
        {
          source: "imessage",
          imessage_chat_guid: chatGuid,
        },
        { onConflict: "source,imessage_chat_guid" },
      )
      .then(({ error: uErr }) => {
        if (uErr) console.error("Digest channel upsert error:", uErr);
      });

    return c.json({ status: "ok" });
  } catch (err) {
    console.error("iMessage webhook error:", err);
    return c.json({ error: "Internal error" }, 500);
  }
});

// Health check
app.get("*", (c) => c.json({ status: "ok", service: "cerebro-imessage" }));

Deno.serve(app.fetch);
