import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import nacl from "tweetnacl";

// Discord Slash Commands Registration (run once via Discord API):
// POST /applications/{app_id}/commands
// {
//   "name": "capture",
//   "description": "Capture a thought or file to Cerebro",
//   "options": [
//     { "name": "thought", "description": "The thought to capture", "type": 3 },
//     { "name": "file", "description": "Attach a file to scan and store", "type": 11 }
//   ]
// }
// {
//   "name": "search",
//   "description": "Search your thoughts",
//   "options": [
//     { "name": "query", "description": "Search query", "type": 3, "required": true }
//   ]
// }

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

// --- File Analysis ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(chunks.join(""));
}

function mimeFromExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
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
  return map[ext] || "application/octet-stream";
}

async function analyzeFileWithVision(
  base64Data: string,
  contentType: string,
  fileName: string,
): Promise<string> {
  const systemPrompt =
    "You are analyzing a file for a personal knowledge base. Describe the contents in detail. If there is text, perform OCR and include it. Provide a comprehensive summary.";

  // Text/CSV: decode and return directly
  if (contentType.startsWith("text/") || contentType === "text/csv") {
    try {
      const decoded = atob(base64Data);
      const preview = decoded.slice(0, 3000);
      return `[Text file: ${fileName}]\n${preview}${decoded.length > 3000 ? "\n...(truncated)" : ""}`;
    } catch {
      return `[Text file: ${fileName}] — could not decode contents.`;
    }
  }

  // DOCX: attempt basic text extraction from XML, fall back to vision description
  if (
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    contentType === "application/msword"
  ) {
    // DOCX/DOC cannot be reliably extracted in Deno without libraries;
    // ask the vision model to describe based on the filename
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
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `A Word document named "${fileName}" was uploaded. I cannot extract its text directly. Please acknowledge this file and note that it has been stored for reference.`,
          },
        ],
      }),
    });
    const d = await r.json();
    return d.choices?.[0]?.message?.content || `[Document: ${fileName}]`;
  }

  // Images and PDFs: send to vision model
  if (contentType.startsWith("image/") || contentType === "application/pdf") {
    const mediaType = contentType === "application/pdf"
      ? "image/png" // Vision models handle PDF first-page as image
      : contentType;
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
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this file (${fileName}). Describe what you see in detail.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${base64Data}`,
                },
              },
            ],
          },
        ],
      }),
    });
    const d = await r.json();
    return d.choices?.[0]?.message?.content || `[File: ${fileName}] — analysis unavailable.`;
  }

  // Fallback for unsupported types
  return `[File: ${fileName}] (${contentType}) — stored but content analysis not supported for this file type.`;
}

async function uploadToStorage(
  buffer: ArrayBuffer,
  filename: string,
  contentType: string,
): Promise<{ url: string | null; path: string | null }> {
  const sanitizedName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `discord/${Date.now()}_${sanitizedName}`;
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

async function sendFollowupWithComponents(
  applicationId: string,
  interactionToken: string,
  content: string,
  components: unknown[],
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, components }),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    console.error(`Discord followup failed: ${r.status} ${msg}`);
  }
}

async function editOriginalMessage(
  applicationId: string,
  interactionToken: string,
  content: string,
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, components: [] }),
  });
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

      // Check for file attachment (option type 11)
      const fileOption = interaction.data?.options?.find(
        (o: { name: string }) => o.name === "file",
      );
      const attachmentId = fileOption?.value;
      const attachment = attachmentId
        ? interaction.data?.resolved?.attachments?.[attachmentId]
        : null;

      if (!thought && !attachment) {
        return c.json({
          type: 4,
          data: {
            content:
              "Please provide a thought or a file. Usage: `/capture thought:your text file:attachment`",
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
      const channelId = interaction.channel_id;
      const guildId = interaction.guild_id;

      // Register this channel for daily digest delivery
      if (channelId) {
        supabase.from("digest_channels").upsert(
          {
            source: "discord",
            discord_channel_id: channelId,
            discord_guild_id: guildId || null,
          },
          { onConflict: "source,discord_channel_id" },
        ).then(({ error: uErr }) => {
          if (uErr) console.error("Digest channel upsert error:", uErr);
        });
      }

      // Use EdgeRuntime.waitUntil to process after responding
      const processPromise = (async () => {
        try {
          let content = thought;
          let fileUrl: string | null = null;
          let fileType: string | null = null;
          let storagePath: string | null = null;
          let fileDescription = "";
          let fileName = "";

          // Process file attachment if present
          if (attachment) {
            fileName = attachment.filename || "unknown_file";
            const attachmentUrl = attachment.url;
            const contentType =
              attachment.content_type || mimeFromExtension(fileName);
            fileType = contentType;

            // File size check (20MB limit)
            if (attachment.size > 20_000_000) {
              fileDescription =
                "File too large to analyze (>20MB). Metadata only.";
              if (content) {
                content += `\n\n📎 File: ${fileName}\n${fileDescription}`;
              } else {
                content = `📎 File: ${fileName}\n${fileDescription}`;
              }
            } else {
              // Download file from Discord CDN
              const fileResponse = await fetch(attachmentUrl);
              if (!fileResponse.ok) {
                throw new Error(
                  `Failed to download file: ${fileResponse.status}`,
                );
              }
              const buffer = await fileResponse.arrayBuffer();

              // Analyze file
              const base64 = arrayBufferToBase64(buffer);
              fileDescription = await analyzeFileWithVision(
                base64,
                contentType,
                fileName,
              );

              // Upload to storage
              const uploadResult = await uploadToStorage(
                buffer,
                fileName,
                contentType,
              );
              fileUrl = uploadResult.url;
              storagePath = uploadResult.path;

              // Build combined content
              if (content) {
                content += `\n\n📎 File: ${fileName}\n${fileDescription}`;
              } else {
                content = `📎 File: ${fileName}\n${fileDescription}`;
              }
            }
          }

          const [embedding, metadata] = await Promise.all([
            getEmbedding(content),
            extractMetadata(content),
          ]);

          // Add file metadata
          if (attachment) {
            (metadata as Record<string, unknown>).has_file = true;
            (metadata as Record<string, unknown>).file_name = fileName;
            (metadata as Record<string, unknown>).file_description =
              fileDescription.slice(0, 500);
          }

          const { data: insertData, error } = await supabase
            .from("thoughts")
            .insert({
              content,
              embedding,
              file_url: fileUrl,
              file_type: fileType,
              metadata: {
                ...metadata,
                source: "discord",
                discord_sender: senderName,
                discord_channel_id: channelId,
                discord_guild_id: guildId,
              },
            })
            .select("id")
            .single();

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
          const calendars = await createCalendarReminders(meta, content);
          if (calendars.length) {
            confirmation += `\n⏰ Reminder created on ${calendars.join(" + ")}`;
          } else if (meta.has_reminder) {
            confirmation += `\n⏰ Reminder detected but no calendar configured`;
          }

          // Add file info to confirmation and send response
          if (attachment && fileUrl) {
            confirmation += `\n\n📎 **${fileName}** — saved to Cerebro storage`;
            confirmation += `\n${fileDescription.slice(0, 300)}`;

            // Send with "Remove file" button
            const thoughtId = insertData?.id;
            if (thoughtId && storagePath) {
              const components = [
                {
                  type: 1, // ACTION_ROW
                  components: [
                    {
                      type: 2, // BUTTON
                      style: 4, // DANGER
                      label: "🗑️ Remove file (keep scan)",
                      custom_id: `remove_file:${thoughtId}:${storagePath}`,
                    },
                  ],
                },
              ];
              await sendFollowupWithComponents(
                applicationId,
                interactionToken,
                confirmation,
                components,
              );
            } else {
              await sendFollowup(
                applicationId,
                interactionToken,
                confirmation,
              );
            }
          } else if (attachment && !fileUrl) {
            confirmation += `\n\n📎 **${fileName}** — scanned (file not saved)`;
            confirmation += `\n${fileDescription.slice(0, 300)}`;
            await sendFollowup(
              applicationId,
              interactionToken,
              confirmation,
            );
          } else {
            await sendFollowup(
              applicationId,
              interactionToken,
              confirmation,
            );
          }
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

  // Type 3: MESSAGE_COMPONENT (button clicks)
  if (interaction.type === 3) {
    const customId = interaction.data?.custom_id || "";
    const applicationId = interaction.application_id;
    const interactionToken = interaction.token;

    if (customId.startsWith("remove_file:")) {
      const parts = customId.split(":");
      const thoughtId = parts[1];
      const storagePath = parts.slice(2).join(":"); // Path might contain colons

      // Process file removal in background
      const removePromise = (async () => {
        try {
          // Delete from storage
          await supabase.storage.from("cerebro-files").remove([storagePath]);

          // Clear file_url and file_type on the thought
          await supabase
            .from("thoughts")
            .update({ file_url: null, file_type: null })
            .eq("id", thoughtId);

          // Update metadata to reflect file removal
          const { data: thought } = await supabase
            .from("thoughts")
            .select("metadata")
            .eq("id", thoughtId)
            .single();

          if (thought?.metadata) {
            const meta = {
              ...(thought.metadata as Record<string, unknown>),
            };
            meta.has_file = false;
            delete meta.file_name;
            delete meta.file_description;
            await supabase
              .from("thoughts")
              .update({ metadata: meta })
              .eq("id", thoughtId);
          }

          // Update the original message to remove buttons
          await editOriginalMessage(
            applicationId,
            interactionToken,
            "📄 File removed from storage. The scanned text is still captured in your thought.",
          );
        } catch (err) {
          console.error("Remove file error:", err);
        }
      })();

      EdgeRuntime.waitUntil(removePromise);

      // Acknowledge the button click immediately (type 6 = DEFERRED_UPDATE_MESSAGE)
      return c.json({ type: 6 });
    }

    // Unknown component interaction
    return c.json({ type: 6 });
  }

  return c.json({}, 200);
});

// Health check
app.get("*", (c) =>
  c.json({ status: "ok", service: "cerebro-discord" }),
);

Deno.serve(app.fetch);
