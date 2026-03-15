/**
 * Cerebro — Daily Digest Edge Function
 *
 * Generates an AI-powered summary of yesterday's thoughts, tasks, reminders,
 * and people interactions, then delivers it to registered Teams and Discord channels.
 *
 * Triggered daily by pg_cron + pg_net, or on-demand via HTTP POST.
 */

import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";

// --- Environment ---

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

// Teams bot credentials (optional — only needed if delivering to Teams)
const TEAMS_BOT_APP_ID = Deno.env.get("TEAMS_BOT_APP_ID");
const TEAMS_BOT_APP_SECRET = Deno.env.get("TEAMS_BOT_APP_SECRET");

// Discord bot token (optional — only needed if delivering to Discord)
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const BF_TOKEN_URL =
  "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Types ---

interface ThoughtRow {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface DigestChannel {
  id: string;
  source: string;
  teams_service_url: string | null;
  teams_conversation_id: string | null;
  teams_user_name: string | null;
  discord_channel_id: string | null;
  discord_guild_id: string | null;
}

interface DigestResult {
  title: string;
  summary: string;
  thoughtCount: number;
  deliveredTo: string[];
}

// --- Data Collection (reused from cerebro-oss patterns) ---

async function getThoughtsSince(since: Date): Promise<ThoughtRow[]> {
  const { data, error } = await supabase
    .from("thoughts")
    .select("id, content, metadata, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching thoughts:", error);
    return [];
  }
  return data || [];
}

async function getCompletedThoughtsSince(since: Date): Promise<ThoughtRow[]> {
  const { data, error } = await supabase
    .from("thoughts")
    .select("id, content, metadata, created_at")
    .eq("metadata->>status", "done")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching completed tasks:", error);
    return [];
  }
  return data || [];
}

async function getUpcomingReminders(withinHours: number): Promise<ThoughtRow[]> {
  const future = new Date(Date.now() + withinHours * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("thoughts")
    .select("id, content, metadata, created_at")
    .eq("metadata->>has_reminder", "true")
    .gte("metadata->>reminder_datetime", new Date().toISOString())
    .lte("metadata->>reminder_datetime", future.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching reminders:", error);
    return [];
  }
  return data || [];
}

// --- LLM Digest Generation ---

function buildDigestPrompt(period: "daily" | "weekly"): string {
  if (period === "daily") {
    return `You are Cerebro, a personal knowledge brain assistant. Summarize today's captured thoughts into a brief daily digest.

Highlight:
- **Key themes** and decisions made
- **Action items** and tasks (open and completed)
- **People** mentioned and any follow-ups needed
- **Reminders** coming up in the next 48 hours
- **Interesting insights** or things learned

Format as markdown suitable for a chat message. Use emoji sparingly for visual structure.
Keep it concise but insightful — aim for 200-400 words.
If there are no thoughts, say so briefly and encouragingly.`;
  }

  return `You are Cerebro, a personal knowledge brain assistant. Analyze the past week's thoughts and produce a comprehensive weekly review.

Your analysis should include:

### 🔄 Recurring Themes & Patterns
- What topics or ideas kept coming up this week?
- Are there emerging patterns in the types of thoughts captured?

### 📈 Progress on Goals & Projects
- What projects or goals saw movement this week?
- What tasks were completed vs what remains open?
- Where is momentum building, and where has it stalled?

### 👥 People & Relationships
- Who was mentioned most this week? In what context?
- Are there follow-ups or conversations needed?
- Note any collaboration patterns or relationship touchpoints.

### 🧠 Key Decisions & Insights
- What decisions were made and why?
- What new insights or learnings emerged?
- Were there any "aha moments" worth revisiting?

### ⚠️ Open Items & Attention Needed
- What action items are still unresolved?
- Are there reminders or deadlines in the coming week?
- What deserves attention in the week ahead?

### 📊 Week at a Glance
- Total thoughts captured and breakdown by type
- Most active capture source (Teams, Discord, Alexa, MCP)
- Busiest day of the week

Format as markdown suitable for a chat message. Use emoji for section headers.
Be thorough but scannable — aim for 400-600 words.
End with 1-2 sentences of encouragement or a forward-looking observation.
If data is sparse, note it and focus on what IS there.`;
}

async function generateDigestContent(
  thoughts: ThoughtRow[],
  completed: ThoughtRow[],
  reminders: ThoughtRow[],
  period: "daily" | "weekly",
): Promise<string> {
  if (thoughts.length === 0 && completed.length === 0 && reminders.length === 0) {
    const timeframe = period === "daily" ? "yesterday" : "this week";
    return `📭 **No thoughts captured ${timeframe}.**\n\nTip: Capture thoughts from Teams, Discord, Alexa, or any MCP client to see them in your digest.`;
  }

  // Build structured input for the LLM
  const sections: string[] = [];

  if (thoughts.length > 0) {
    const thoughtList = thoughts
      .map((t) => {
        const m = t.metadata || {};
        const type = m.type || "thought";
        const title = m.title || t.content.substring(0, 80);
        const people = Array.isArray(m.people) && m.people.length
          ? ` [People: ${(m.people as string[]).join(", ")}]`
          : "";
        const actions = Array.isArray(m.action_items) && m.action_items.length
          ? `\n  Actions: ${(m.action_items as string[]).join("; ")}`
          : "";
        const source = m.source ? ` (via ${m.source})` : "";
        const date = new Date(t.created_at).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
        });
        return `- [${type}] ${title}${people}${source} (${date}): ${t.content.substring(0, 200)}${actions}`;
      })
      .join("\n");
    sections.push(`## Captured Thoughts (${thoughts.length})\n${thoughtList}`);
  }

  if (completed.length > 0) {
    const completedList = completed
      .map((t) => {
        const m = t.metadata || {};
        const title = m.title || t.content.substring(0, 80);
        return `- ✅ ${title}`;
      })
      .join("\n");
    sections.push(`## Completed Tasks (${completed.length})\n${completedList}`);
  }

  if (reminders.length > 0) {
    const reminderList = reminders
      .map((t) => {
        const m = t.metadata || {};
        return `- ⏰ ${m.reminder_title || "Reminder"} — ${m.reminder_datetime}`;
      })
      .join("\n");
    sections.push(`## Upcoming Reminders\n${reminderList}`);
  }

  // For weekly: add aggregate stats to help the LLM
  if (period === "weekly" && thoughts.length > 0) {
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const allPeople = new Set<string>();

    for (const t of thoughts) {
      const m = t.metadata || {};
      const type = (m.type as string) || "thought";
      const source = (m.source as string) || "unknown";
      const day = new Date(t.created_at).toLocaleDateString("en-US", { weekday: "long" });

      byType[type] = (byType[type] || 0) + 1;
      bySource[source] = (bySource[source] || 0) + 1;
      byDay[day] = (byDay[day] || 0) + 1;

      if (Array.isArray(m.people)) {
        for (const p of m.people) allPeople.add(p as string);
      }
    }

    const statsLines = [
      `Types: ${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(", ")}`,
      `Sources: ${Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(", ")}`,
      `By day: ${Object.entries(byDay).map(([k, v]) => `${k}(${v})`).join(", ")}`,
    ];
    if (allPeople.size > 0) {
      statsLines.push(`People mentioned: ${Array.from(allPeople).join(", ")}`);
    }
    sections.push(`## Week Stats\n${statsLines.join("\n")}`);
  }

  const userMessage = sections.join("\n\n");

  const r = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: buildDigestPrompt(period) },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    console.error(`OpenRouter digest failed: ${r.status} ${msg}`);
    return `⚠️ Could not generate AI summary. Raw stats: ${thoughts.length} thoughts captured, ${reminders.length} upcoming reminders.`;
  }

  const d = await r.json();
  return d.choices?.[0]?.message?.content || "Digest generation returned empty.";
}

// --- Channel Delivery: Teams ---

let botTokenCache: { token: string; expires: number } | null = null;

async function getTeamsBotToken(): Promise<string> {
  if (botTokenCache && Date.now() < botTokenCache.expires) {
    return botTokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: TEAMS_BOT_APP_ID!,
    client_secret: TEAMS_BOT_APP_SECRET!,
    scope: "https://api.botframework.com/.default",
  });

  const r = await fetch(BF_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!r.ok) throw new Error(`Teams bot token failed: ${r.status}`);

  const data = await r.json();
  botTokenCache = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 300) * 1000,
  };
  return botTokenCache.token;
}

async function sendTeamsMessage(
  serviceUrl: string,
  conversationId: string,
  message: string,
): Promise<boolean> {
  try {
    const token = await getTeamsBotToken();
    const url = `${serviceUrl}v3/conversations/${conversationId}/activities`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "message", text: message }),
    });

    if (!r.ok) {
      const msg = await r.text().catch(() => "");
      console.error(`Teams delivery failed: ${r.status} ${msg}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Teams delivery error:", err);
    return false;
  }
}

// --- Channel Delivery: Discord ---

async function sendDiscordMessage(
  channelId: string,
  content: string,
): Promise<boolean> {
  try {
    // Discord messages have a 2000 char limit — split if needed
    const chunks = splitMessage(content, 2000);

    for (const chunk of chunks) {
      const r = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: chunk }),
        },
      );

      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        console.error(`Discord delivery failed: ${r.status} ${msg}`);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("Discord delivery error:", err);
    return false;
  }
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt <= 0) splitAt = maxLen;

    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).trimStart();
  }

  return chunks;
}

// --- Delivery Orchestration ---

async function getDigestChannels(): Promise<DigestChannel[]> {
  const { data, error } = await supabase
    .from("digest_channels")
    .select("*")
    .eq("enabled", true);

  if (error) {
    console.error("Error fetching digest channels:", error);
    return [];
  }
  return data || [];
}

async function deliverDigest(
  channels: DigestChannel[],
  digestText: string,
): Promise<string[]> {
  const delivered: string[] = [];

  const teamsChannels = channels.filter(
    (ch) => ch.source === "teams" && ch.teams_service_url && ch.teams_conversation_id,
  );
  const discordChannels = channels.filter(
    (ch) => ch.source === "discord" && ch.discord_channel_id,
  );

  // Deliver to all channels in parallel
  const deliveryPromises: Promise<void>[] = [];

  for (const ch of teamsChannels) {
    if (!TEAMS_BOT_APP_ID || !TEAMS_BOT_APP_SECRET) continue;
    deliveryPromises.push(
      sendTeamsMessage(ch.teams_service_url!, ch.teams_conversation_id!, digestText)
        .then((ok) => {
          if (ok) delivered.push(`teams:${ch.teams_user_name || ch.teams_conversation_id}`);
        }),
    );
  }

  for (const ch of discordChannels) {
    if (!DISCORD_BOT_TOKEN) continue;
    deliveryPromises.push(
      sendDiscordMessage(ch.discord_channel_id!, digestText)
        .then((ok) => {
          if (ok) delivered.push(`discord:${ch.discord_channel_id}`);
        }),
    );
  }

  await Promise.all(deliveryPromises);

  // Update last_digest_at for delivered channels
  if (delivered.length > 0) {
    const deliveredIds = channels
      .filter((ch) =>
        delivered.some((d) => d.startsWith(ch.source))
      )
      .map((ch) => ch.id);

    if (deliveredIds.length > 0) {
      await supabase
        .from("digest_channels")
        .update({ last_digest_at: new Date().toISOString() })
        .in("id", deliveredIds);
    }
  }

  return delivered;
}

// --- Main Digest Pipeline ---

async function runDigest(period: "daily" | "weekly" = "daily"): Promise<DigestResult> {
  const hours = period === "daily" ? 24 : 168;
  const reminderHours = period === "daily" ? 48 : 168;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  // Collect data in parallel
  const [thoughts, completed, reminders, channels] = await Promise.all([
    getThoughtsSince(since),
    getCompletedThoughtsSince(since),
    getUpcomingReminders(reminderHours),
    getDigestChannels(),
  ]);

  // Generate digest content
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const title = `🧠 Cerebro ${period === "daily" ? "Daily" : "Weekly"} Digest — ${dateStr}`;

  const aiSummary = await generateDigestContent(thoughts, completed, reminders, period);
  const fullDigest = `**${title}**\n\n${aiSummary}`;

  // Deliver to registered channels
  const deliveredTo = await deliverDigest(channels, fullDigest);

  return {
    title,
    summary: aiSummary,
    thoughtCount: thoughts.length,
    deliveredTo,
  };
}

// --- Hono App ---

const app = new Hono();

// POST: Triggered by pg_cron or manual invocation
app.post("*", async (c) => {
  try {
    let period: "daily" | "weekly" = "daily";

    try {
      const body = await c.req.json();
      if (body.period === "weekly") period = "weekly";
    } catch {
      // No body or invalid JSON — default to daily
    }

    const result = await runDigest(period);

    return c.json({
      success: true,
      title: result.title,
      thoughtCount: result.thoughtCount,
      deliveredTo: result.deliveredTo,
      summary: result.summary,
    });
  } catch (err) {
    console.error("Digest error:", err);
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// GET: Health check + on-demand digest generation
app.get("*", async (c) => {
  const period = c.req.query("period") === "weekly" ? "weekly" : "daily";
  const generate = c.req.query("generate");

  if (generate === "true") {
    try {
      const result = await runDigest(period);
      return c.json({
        success: true,
        title: result.title,
        thoughtCount: result.thoughtCount,
        deliveredTo: result.deliveredTo,
        summary: result.summary,
      });
    } catch (err) {
      console.error("Digest error:", err);
      return c.json({ success: false, error: (err as Error).message }, 500);
    }
  }

  return c.json({ status: "ok", service: "cerebro-digest" });
});

Deno.serve(app.fetch);
