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
        {
          role: "system",
          content: `Extract metadata from the user's captured thought. Return JSON with:
- "people": array of people mentioned (empty if none)
- "action_items": array of implied to-dos (empty if none)
- "dates_mentioned": array of dates YYYY-MM-DD (empty if none)
- "topics": array of 1-3 short topic tags (always at least one)
- "type": one of "observation", "task", "idea", "reference", "person_note"
Only extract what's explicitly there.`,
        },
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
