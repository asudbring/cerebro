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
