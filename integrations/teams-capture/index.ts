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

// --- Reply with Adaptive Card ---

async function replyWithAdaptiveCard(
  serviceUrl: string,
  conversationId: string,
  activityId: string,
  cardBody: unknown,
): Promise<string | null> {
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
      attachments: [{
        contentType: "application/vnd.microsoft.card.adaptive",
        content: cardBody,
      }],
    }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.id || null;
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

// --- File Attachment Helpers ---

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain",
  csv: "text/csv",
};

function mimeFromExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return MIME_TYPES[ext] || "application/octet-stream";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function analyzeFileWithVision(
  base64Data: string,
  contentType: string,
  fileName: string,
): Promise<{ description: string; fileType: string }> {
  const isImage = contentType.startsWith("image/");

  if (isImage) {
    try {
      const dataUri = `data:${contentType};base64,${base64Data}`;
      const r = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          max_tokens: 1000,
          temperature: 0.2,
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: dataUri } },
              {
                type: "text",
                text:
                  "Describe this image in detail. If there is any text visible (OCR), transcribe it. Be thorough but concise.",
              },
            ],
          }],
        }),
      });
      if (!r.ok) {
        console.error("Vision API error:", await r.text().catch(() => ""));
        return { description: `Image file: ${fileName}`, fileType: "image" };
      }
      const d = await r.json();
      return {
        description:
          d.choices?.[0]?.message?.content || `Image file: ${fileName}`,
        fileType: "image",
      };
    } catch (err) {
      console.error("Vision analysis failed:", err);
      return { description: `Image file: ${fileName}`, fileType: "image" };
    }
  }

  if (contentType === "application/pdf") {
    return {
      description:
        `PDF document: ${fileName}. File has been saved to storage for reference.`,
      fileType: "pdf",
    };
  }

  if (
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    contentType === "application/msword"
  ) {
    return {
      description:
        `Word document: ${fileName}. File has been saved to storage for reference.`,
      fileType: "document",
    };
  }

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const fileType = ["csv", "txt"].includes(ext) ? "text" : "file";
  return { description: `File attached: ${fileName}`, fileType };
}

async function uploadToStorage(
  buffer: ArrayBuffer,
  filename: string,
  contentType: string,
): Promise<{ url: string | null; storagePath: string }> {
  const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `teams/${Date.now()}_${sanitizedName}`;
  const { error } = await supabase.storage
    .from("cerebro-files")
    .upload(storagePath, buffer, { contentType });
  if (error) {
    console.error("Storage upload error:", error);
    return { url: null, storagePath };
  }
  const { data: urlData } = await supabase.storage
    .from("cerebro-files")
    .createSignedUrl(storagePath, 365 * 24 * 60 * 60);
  return { url: urlData?.signedUrl || null, storagePath };
}

// deno-lint-ignore no-explicit-any
function getFileAttachments(attachments: any[]): any[] {
  if (!attachments) return [];
  return attachments.filter((att) =>
    att.contentType ===
      "application/vnd.microsoft.teams.file.download.info" ||
    att.contentType?.startsWith("image/") ||
    (att.contentType?.startsWith("application/") &&
      att.contentType !== "application/vnd.microsoft.card.adaptive") ||
    att.contentUrl?.includes("sharepoint.com")
  );
}

function buildFileCard(
  fileName: string,
  fileDescription: string,
  thoughtType: string,
  topics: string[],
  thoughtId: string,
  storagePath: string,
): unknown {
  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        text: `✅ Captured as **${thoughtType}**${
          topics.length ? ` — ${topics.join(", ")}` : ""
        }`,
        wrap: true,
      },
      {
        type: "TextBlock",
        text: `📎 **${fileName}**`,
        wrap: true,
        weight: "Bolder",
      },
      {
        type: "TextBlock",
        text: fileDescription.slice(0, 500),
        wrap: true,
        size: "Small",
      },
      {
        type: "TextBlock",
        text: "💾 File saved to Cerebro storage.",
        wrap: true,
        color: "Good",
        size: "Small",
      },
    ],
    actions: [
      {
        type: "Action.Execute",
        title: "🗑️ Remove file (keep scan)",
        data: {
          action: "remove_file",
          thoughtId,
          storagePath,
        },
      },
    ],
  };
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

    // --- Handle invoke activities (Adaptive Card button clicks) ---
    if (activity.type === "invoke" && activity.name === "adaptiveCard/action") {
      const actionData = activity.value?.action?.data || {};
      const { action, thoughtId, storagePath } = actionData;

      if (action === "remove_file" && thoughtId && storagePath) {
        await supabase.storage.from("cerebro-files").remove([storagePath]);
        await supabase
          .from("thoughts")
          .update({ file_url: null, file_type: null })
          .eq("id", thoughtId);

        const { data: thought } = await supabase
          .from("thoughts")
          .select("metadata")
          .eq("id", thoughtId)
          .single();
        if (thought) {
          const meta = {
            ...(thought.metadata as Record<string, unknown>),
            has_file: false,
          };
          delete meta.file_name;
          delete meta.file_description;
          await supabase
            .from("thoughts")
            .update({ metadata: meta })
            .eq("id", thoughtId);
        }

        return c.json({
          status: 200,
          body: {
            statusCode: 200,
            type: "application/vnd.microsoft.activity.message",
            value:
              "📄 File removed from storage. The scanned text is still captured in your thought.",
          },
        });
      }

      return c.json({ status: 200, body: {} });
    }

    // Only process message activities
    if (activity.type !== "message") {
      return c.json({}, 200);
    }

    const rawText: string = activity.text || "";
    const serviceUrl: string = activity.serviceUrl.endsWith("/")
      ? activity.serviceUrl
      : activity.serviceUrl + "/";
    const conversationId: string = activity.conversation.id;
    const activityId: string = activity.id;
    const senderName: string = activity.from?.name || "unknown";

    // Strip @mention to get the actual thought content
    const messageText = stripBotMention(rawText, activity.recipient?.name);

    // Check for file attachments
    const fileAttachments = getFileAttachments(activity.attachments);

    if (!messageText && fileAttachments.length === 0) {
      await replyToActivity(
        serviceUrl,
        conversationId,
        activityId,
        "Send me a thought to capture! Just type your message or send a file.",
      );
      return c.json({}, 200);
    }

    // Register this conversation for daily digest delivery
    await supabase
      .from("digest_channels")
      .upsert(
        {
          source: "teams",
          teams_service_url: serviceUrl,
          teams_conversation_id: conversationId,
          teams_user_name: senderName,
        },
        { onConflict: "source,teams_conversation_id" },
      )
      .then(({ error: uErr }) => {
        if (uErr) console.error("Digest channel upsert error:", uErr);
      });

    // --- File attachment handling ---
    if (fileAttachments.length > 0) {
      const attachment = fileAttachments[0];
      const downloadUrl =
        attachment.content?.downloadUrl || attachment.contentUrl;
      const fileName: string = attachment.name || "unknown_file";

      try {
        const fileResponse = await fetch(downloadUrl);
        if (!fileResponse.ok) {
          throw new Error(`File download failed: ${fileResponse.status}`);
        }
        const buffer = await fileResponse.arrayBuffer();

        // Resolve content type
        let contentType: string = attachment.contentType || "";
        if (
          contentType ===
            "application/vnd.microsoft.teams.file.download.info" ||
          !contentType ||
          contentType === "text/html"
        ) {
          contentType = mimeFromExtension(fileName);
        }

        // Analyze the file
        const base64Data = arrayBufferToBase64(buffer);
        const analysis = await analyzeFileWithVision(
          base64Data,
          contentType,
          fileName,
        );

        // Build combined content
        const combinedContent = messageText
          ? `${messageText}\n\n📎 File: ${fileName}\n${analysis.description}`
          : `📎 File: ${fileName}\n${analysis.description}`;

        // Upload to storage
        const { url: fileUrl, storagePath } = await uploadToStorage(
          buffer,
          fileName,
          contentType,
        );

        // Parallel: embedding + metadata extraction
        const [embedding, metadata] = await Promise.all([
          getEmbedding(combinedContent),
          extractMetadata(combinedContent),
        ]);

        // Store thought with file info
        const { data: thought, error } = await supabase
          .from("thoughts")
          .insert({
            content: combinedContent,
            embedding,
            file_url: fileUrl,
            file_type: analysis.fileType,
            metadata: {
              ...metadata,
              source: "teams",
              teams_sender: senderName,
              teams_conversation_id: conversationId,
              has_file: true,
              file_name: fileName,
              file_description: analysis.description.slice(0, 200),
            },
          })
          .select("id")
          .single();

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

        const meta = metadata as Record<string, unknown>;
        const thoughtId = thought?.id;

        // Send Adaptive Card reply
        const card = buildFileCard(
          fileName,
          analysis.description,
          (meta.type as string) || "thought",
          (meta.topics as string[]) || [],
          thoughtId,
          storagePath,
        );
        await replyWithAdaptiveCard(
          serviceUrl,
          conversationId,
          activityId,
          card,
        );

        // Create calendar reminders if detected
        const calendars = await createCalendarReminders(meta, combinedContent);
        if (calendars.length) {
          await replyToActivity(
            serviceUrl,
            conversationId,
            activityId,
            `⏰ Reminder created on ${calendars.join(" + ")}`,
          );
        }

        return c.json({}, 200);
      } catch (err) {
        console.error("File processing error:", err);
        if (!messageText) {
          await replyToActivity(
            serviceUrl,
            conversationId,
            activityId,
            `❌ Failed to process file: ${(err as Error).message}`,
          );
          return c.json({}, 200);
        }
        // Fall through to text-only flow if there's message text
      }
    }

    // --- Text-only flow (existing behavior) ---
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
