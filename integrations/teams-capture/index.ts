import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import * as jose from "jose";

// --- Environment ---

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const BOT_APP_ID = Deno.env.get("TEAMS_BOT_APP_ID")!;
const BOT_APP_SECRET = Deno.env.get("TEAMS_BOT_APP_SECRET")!;

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const BF_OPENID_URL =
  "https://login.botframework.com/v1/.well-known/openidconfiguration";
const BF_TOKEN_URL =
  "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- JWKS for Bot Framework token validation ---

let jwksCache: jose.JSONWebKeySet | null = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600_000; // 1 hour

async function getJWKS(): Promise<jose.JSONWebKeySet> {
  if (jwksCache && Date.now() - jwksCacheTime < JWKS_CACHE_TTL) {
    return jwksCache;
  }
  const openIdConfig = await fetch(BF_OPENID_URL).then((r) => r.json());
  jwksCache = await fetch(openIdConfig.jwks_uri).then((r) => r.json());
  jwksCacheTime = Date.now();
  return jwksCache!;
}

// --- Validate incoming Bot Framework JWT ---

async function validateBotFrameworkToken(
  authHeader: string,
): Promise<boolean> {
  try {
    if (!authHeader.startsWith("Bearer ")) return false;
    const token = authHeader.slice(7);

    const jwks = await getJWKS();
    const keyStore = jose.createLocalJWKSet(jwks);

    const { payload } = await jose.jwtVerify(token, keyStore, {
      issuer: "https://api.botframework.com",
      audience: BOT_APP_ID,
    });

    return !!payload;
  } catch (err) {
    console.error("JWT validation failed:", err);
    return false;
  }
}

// --- Get bot OAuth token for sending replies ---

let botTokenCache: { token: string; expires: number } | null = null;

async function getBotToken(): Promise<string> {
  if (botTokenCache && Date.now() < botTokenCache.expires) {
    return botTokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: BOT_APP_ID,
    client_secret: BOT_APP_SECRET,
    scope: "https://api.botframework.com/.default",
  });

  const r = await fetch(BF_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`Bot token request failed: ${r.status} ${msg}`);
  }

  const data = await r.json();
  botTokenCache = {
    token: data.access_token,
    // Expire 5 minutes early to avoid edge cases
    expires: Date.now() + (data.expires_in - 300) * 1000,
  };
  return botTokenCache.token;
}

// --- Reply to a Teams conversation ---

async function replyToActivity(
  serviceUrl: string,
  conversationId: string,
  activityId: string,
  text: string,
): Promise<void> {
  const token = await getBotToken();
  const url = `${serviceUrl}v3/conversations/${conversationId}/activities/${activityId}`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "message",
      text,
    }),
  });

  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    console.error(`Reply failed: ${r.status} ${msg}`);
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

// --- Strip bot @mention from message text ---

function stripBotMention(text: string, botName?: string): string {
  // Teams wraps @mentions in <at>BotName</at> tags
  let cleaned = text.replace(/<at>[^<]*<\/at>/gi, "").trim();
  // Also strip plain @BotName if present
  if (botName) {
    cleaned = cleaned
      .replace(new RegExp(`@${botName}`, "gi"), "")
      .trim();
  }
  return cleaned;
}

// --- Hono App ---

const app = new Hono();

app.post("*", async (c) => {
  try {
    // Validate the Bot Framework JWT
    const authHeader = c.req.header("Authorization") || "";
    const valid = await validateBotFrameworkToken(authHeader);
    if (!valid) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const activity = await c.req.json();

    // Only process message activities with text
    if (activity.type !== "message" || !activity.text) {
      return c.json({}, 200);
    }

    const rawText: string = activity.text;
    const serviceUrl: string = activity.serviceUrl.endsWith("/")
      ? activity.serviceUrl
      : activity.serviceUrl + "/";
    const conversationId: string = activity.conversation.id;
    const activityId: string = activity.id;
    const senderName: string = activity.from?.name || "unknown";

    // Strip @mention to get the actual thought content
    const messageText = stripBotMention(rawText, activity.recipient?.name);

    if (!messageText) {
      await replyToActivity(
        serviceUrl,
        conversationId,
        activityId,
        "Send me a thought to capture! Just type your message.",
      );
      return c.json({}, 200);
    }

    // Register this conversation for daily digest delivery
    await supabase.from("digest_channels").upsert(
      {
        source: "teams",
        teams_service_url: serviceUrl,
        teams_conversation_id: conversationId,
        teams_user_name: senderName,
      },
      { onConflict: "source,teams_conversation_id" },
    ).then(({ error: uErr }) => {
      if (uErr) console.error("Digest channel upsert error:", uErr);
    });

    // Parallel: embedding + metadata extraction
    const [embedding, metadata] = await Promise.all([
      getEmbedding(messageText),
      extractMetadata(messageText),
    ]);

    // Store in Supabase
    const { error } = await supabase.from("thoughts").insert({
      content: messageText,
      embedding,
      metadata: {
        ...metadata,
        source: "teams",
        teams_sender: senderName,
        teams_conversation_id: conversationId,
      },
    });

    if (error) {
      console.error("Supabase insert error:", error);
      await replyToActivity(
        serviceUrl,
        conversationId,
        activityId,
        `❌ Failed to capture: ${error.message}`,
      );
      return c.json({}, 200);
    }

    // Build confirmation message
    const meta = metadata as Record<string, unknown>;
    let confirmation = `✅ Captured as **${meta.type || "thought"}**`;
    if (Array.isArray(meta.topics) && meta.topics.length)
      confirmation += ` — ${(meta.topics as string[]).join(", ")}`;
    if (Array.isArray(meta.people) && meta.people.length)
      confirmation += `\n\n👤 People: ${(meta.people as string[]).join(", ")}`;
    if (Array.isArray(meta.action_items) && meta.action_items.length)
      confirmation += `\n\n📋 Actions: ${(meta.action_items as string[]).join("; ")}`;

    // Create calendar reminders if detected
    const calendars = await createCalendarReminders(meta, messageText);
    if (calendars.length) {
      confirmation += `\n\n⏰ Reminder created on ${calendars.join(" + ")}`;
    } else if (meta.has_reminder) {
      confirmation += `\n\n⏰ Reminder detected but no calendar configured`;
    }

    await replyToActivity(
      serviceUrl,
      conversationId,
      activityId,
      confirmation,
    );

    return c.json({}, 200);
  } catch (err) {
    console.error("Function error:", err);
    return c.json({ error: "Internal error" }, 500);
  }
});

// Handle GET for health checks
app.get("*", (c) => c.json({ status: "ok", service: "cerebro-teams" }));

Deno.serve(app.fetch);
