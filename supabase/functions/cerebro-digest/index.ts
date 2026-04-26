/**
 * Cerebro — Daily Digest Edge Function
 *
 * Generates an AI-powered summary of yesterday's thoughts, tasks, reminders,
 * and people interactions, then delivers it to registered Teams, Discord, and iMessage channels.
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
const TEAMS_BOT_TENANT_ID = Deno.env.get("TEAMS_BOT_TENANT_ID");

// Discord bot token (optional — only needed if delivering to Discord)
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");

// BlueBubbles / iMessage (optional — only needed if delivering to iMessage)
const BLUEBUBBLES_URL = Deno.env.get("BLUEBUBBLES_URL");
const BLUEBUBBLES_PASSWORD = Deno.env.get("BLUEBUBBLES_PASSWORD");

// Email delivery via Resend (optional — free tier: 100 emails/day)
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const DIGEST_EMAIL_TO = Deno.env.get("DIGEST_EMAIL_TO"); // recipient address(es), comma-separated
const DIGEST_EMAIL_FROM = Deno.env.get("DIGEST_EMAIL_FROM") || "Cerebro <onboarding@resend.dev>"; // default uses Resend test domain

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const BF_TOKEN_URL = TEAMS_BOT_TENANT_ID
  ? `https://login.microsoftonline.com/${TEAMS_BOT_TENANT_ID}/oauth2/v2.0/token`
  : "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token";

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
  imessage_chat_guid: string | null;
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
    .neq("status", "deleted")
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
    .eq("status", "done")
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
    .neq("status", "deleted")
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
  const sharedRules = `The user message contains pre-bucketed sections delimited by \`=== SECTION NAME ===\` headers. Render the digest as markdown using exactly these section headers, in this order, and ONLY include a section if its bucket has content:

## ✅ Action Items
## 📧 Important Emails
## 📅 Calendar Highlights
## 📝 OneNote Updates
## 📄 Document Activity
## 💭 Captured Thoughts
## ✅ Completed Tasks
## ⏰ Upcoming Reminders

Per-item rules:
- Keep each item to 1–3 lines max. Be terse and scannable.
- Whenever an item has a \`Link:\` value, render it as a clickable markdown link with the appropriate label using the exact URL provided:
  - Emails → \`[Open in Outlook](URL)\`
  - Calendar events → \`[Open in Calendar](URL)\`
  - OneNote pages → \`[Open in OneNote](URL)\`
  - Documents/files → \`[Open document](URL)\`
- Do NOT emit an empty section header. If a bucket is missing from the input, omit that section entirely.
- Do NOT invent items, links, senders, or times that aren't in the input.`;

  if (period === "daily") {
    return `You are Cerebro, a personal knowledge brain assistant. Produce a brief daily digest of the last 24 hours of activity.

${sharedRules}

Daily-specific guidance:
- Focus on what needs attention TODAY — surface action items, time-sensitive emails, and meetings up front.
- Keep the overall digest brief and scannable. Aim for ~200–400 words total.
- If the input is sparse, say so briefly and encouragingly.`;
  }

  return `You are Cerebro, a personal knowledge brain assistant. Produce a comprehensive weekly review of the last 7 days of activity.

${sharedRules}

Weekly-specific guidance:
- After the standard sections, add a short \`## 📊 Week at a Glance\` section that reflects on patterns and includes per-source counts (captured / emails / meetings / notes / documents) using the \`=== WEEK STATS ===\` block from the input.
- Reflect on recurring themes, progress on goals, people touchpoints, and what deserves attention next week.
- Aim for ~400–600 words. End with 1–2 sentences of forward-looking observation or encouragement.
- If data is sparse, note it and focus on what IS there.`;
}

// Helper: safely stringify a possibly-unknown metadata field
function s(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

async function generateDigestContent(
  thoughts: ThoughtRow[],
  completed: ThoughtRow[],
  reminders: ThoughtRow[],
  period: "daily" | "weekly",
): Promise<string> {
  // Bucket thoughts by metadata.source — Graph-ingested rows go into dedicated
  // sections; everything else (Teams/Discord/iMessage/Alexa/MCP captures) falls
  // into the generic "captured" bucket.
  const emails: ThoughtRow[] = [];
  const calendar: ThoughtRow[] = [];
  const notes: ThoughtRow[] = [];
  const documents: ThoughtRow[] = [];
  const captured: ThoughtRow[] = [];

  for (const t of thoughts) {
    const src = s((t.metadata || {}).source);
    if (src === "graph-mail") emails.push(t);
    else if (src === "graph-event") calendar.push(t);
    else if (src === "graph-onenote") notes.push(t);
    else if (src === "graph-file") documents.push(t);
    else captured.push(t);
  }

  // Aggregate action items across all Graph-ingested rows, dedup case-insensitively
  // while preserving the first-seen casing.
  const actionItemMap = new Map<string, string>();
  for (const t of [...emails, ...calendar, ...notes, ...documents]) {
    const items = (t.metadata || {}).action_items;
    if (Array.isArray(items)) {
      for (const it of items) {
        const str = s(it).trim();
        if (!str) continue;
        const key = str.toLowerCase();
        if (!actionItemMap.has(key)) actionItemMap.set(key, str);
      }
    }
  }
  const actionItems = Array.from(actionItemMap.values());

  if (
    emails.length === 0 &&
    calendar.length === 0 &&
    notes.length === 0 &&
    documents.length === 0 &&
    captured.length === 0 &&
    completed.length === 0 &&
    reminders.length === 0
  ) {
    const timeframe = period === "daily" ? "yesterday" : "this week";
    return `📭 **No thoughts captured ${timeframe}.**\n\nTip: Capture thoughts from Teams, Discord, Alexa, or any MCP client to see them in your digest.`;
  }

  // Build structured input for the LLM
  const sections: string[] = [];

  if (actionItems.length > 0) {
    const list = actionItems.map((a) => `- ${a}`).join("\n");
    sections.push(`=== ACTION ITEMS ===\n${list}`);
  }

  if (emails.length > 0) {
    const list = emails
      .map((t) => {
        const m = t.metadata || {};
        const subject = s(m.subject) || s(m.title) || t.content.substring(0, 80);
        const senderName = s(m.sender_name);
        const sender = s(m.sender);
        let header: string;
        if (senderName && sender) header = `From ${senderName} (${sender}) — ${subject}`;
        else if (senderName || sender) header = `From ${senderName || sender} — ${subject}`;
        else header = subject;
        const received = s(m.received_at);
        const link = s(m.original_url);
        const lines = [`- ${header}`];
        if (t.content) lines.push(`  Summary: ${t.content.substring(0, 300)}`);
        if (received) lines.push(`  Received: ${received}`);
        if (link) lines.push(`  Link: ${link}`);
        return lines.join("\n");
      })
      .join("\n");
    sections.push(`=== IMPORTANT EMAILS ===\n${list}`);
  }

  if (calendar.length > 0) {
    const list = calendar
      .map((t) => {
        const m = t.metadata || {};
        const subject = s(m.subject) || s(m.title) || t.content.substring(0, 80);
        const start = s(m.start);
        const end = s(m.end);
        const location = s(m.location);
        const organizer = s(m.organizer);
        const link = s(m.original_url);
        const headerParts = [subject];
        if (start || end) headerParts.push(`${start} → ${end}`);
        if (location) headerParts.push(location);
        const lines = [`- ${headerParts.join(" | ")}`];
        if (organizer) lines.push(`  Organizer: ${organizer}`);
        if (t.content) lines.push(`  Summary: ${t.content.substring(0, 300)}`);
        if (link) lines.push(`  Link: ${link}`);
        return lines.join("\n");
      })
      .join("\n");
    sections.push(`=== CALENDAR HIGHLIGHTS ===\n${list}`);
  }

  if (notes.length > 0) {
    const list = notes
      .map((t) => {
        const m = t.metadata || {};
        const title = s(m.title) || s(m.subject) || t.content.substring(0, 80);
        const section = s(m.section);
        const modified = s(m.modified_at);
        const link = s(m.original_url);
        const lines = [`- ${title}${section ? ` (${section})` : ""}`];
        if (t.content) lines.push(`  Summary: ${t.content.substring(0, 300)}`);
        if (modified) lines.push(`  Modified: ${modified}`);
        if (link) lines.push(`  Link: ${link}`);
        return lines.join("\n");
      })
      .join("\n");
    sections.push(`=== ONENOTE UPDATES ===\n${list}`);
  }

  if (documents.length > 0) {
    const list = documents
      .map((t) => {
        const m = t.metadata || {};
        const name = s(m.name) || s(m.title) || t.content.substring(0, 80);
        const fileType = s(m.file_type);
        const modifiedBy = s(m.modified_by);
        const modified = s(m.modified_at);
        const link = s(m.original_url);
        const header =
          `${name}${fileType ? ` (${fileType})` : ""}${modifiedBy ? ` — modified by ${modifiedBy}` : ""}`;
        const lines = [`- ${header}`];
        if (modified) lines.push(`  Modified: ${modified}`);
        if (link) lines.push(`  Link: ${link}`);
        return lines.join("\n");
      })
      .join("\n");
    sections.push(`=== DOCUMENT ACTIVITY ===\n${list}`);
  }

  if (captured.length > 0) {
    const thoughtList = captured
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
    sections.push(`=== CAPTURED THOUGHTS ===\n${thoughtList}`);
  }

  if (completed.length > 0) {
    const completedList = completed
      .map((t) => {
        const m = t.metadata || {};
        const title = m.title || t.content.substring(0, 80);
        return `- ✅ ${title}`;
      })
      .join("\n");
    sections.push(`=== COMPLETED TASKS ===\n${completedList}`);
  }

  if (reminders.length > 0) {
    const reminderList = reminders
      .map((t) => {
        const m = t.metadata || {};
        return `- ⏰ ${m.reminder_title || "Reminder"} — ${m.reminder_datetime}`;
      })
      .join("\n");
    sections.push(`=== UPCOMING REMINDERS ===\n${reminderList}`);
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
      `Sources: ${captured.length} captured, ${emails.length} emails, ${calendar.length} meetings, ${notes.length} notes, ${documents.length} documents`,
      `Types: ${Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(", ")}`,
      `By source: ${Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}(${v})`).join(", ")}`,
      `By day: ${Object.entries(byDay).map(([k, v]) => `${k}(${v})`).join(", ")}`,
    ];
    if (allPeople.size > 0) {
      statsLines.push(`People mentioned: ${Array.from(allPeople).join(", ")}`);
    }
    sections.push(`=== WEEK STATS ===\n${statsLines.join("\n")}`);
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

// --- Channel Delivery: iMessage via BlueBubbles ---

async function sendImessageMessage(
  chatGuid: string,
  text: string,
): Promise<boolean> {
  if (!BLUEBUBBLES_URL || !BLUEBUBBLES_PASSWORD) return false;
  try {
    const pw = encodeURIComponent(BLUEBUBBLES_PASSWORD);
    const base = BLUEBUBBLES_URL.replace(/\/+$/, "");
    // Prefix with zero-width space to prevent loop in capture function
    const prefixed = `\u200B${text}`;
    const chunks = splitMessage(prefixed, 5000);
    for (const chunk of chunks) {
      const r = await fetch(
        `${base}/api/v1/message/text?guid=${pw}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatGuid,
            text: chunk,
            method: "apple-script",
          }),
        },
      );
      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        console.error(`iMessage delivery failed: ${r.status} ${msg}`);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error("iMessage delivery error:", err);
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

// --- Channel Delivery: Email via Resend ---

function markdownToHtml(markdown: string, title: string): string {
  // Process block-level elements first, then inline
  const lines = markdown.split("\n");
  const outputLines: string[] = [];
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      if (inUl) { outputLines.push("</ul>"); inUl = false; }
      if (inOl) { outputLines.push("</ol>"); inOl = false; }
      outputLines.push('<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">');
      continue;
    }

    // Headers (h1–h6)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inUl) { outputLines.push("</ul>"); inUl = false; }
      if (inOl) { outputLines.push("</ol>"); inOl = false; }
      const level = headingMatch[1].length;
      const text = inlineMarkdown(headingMatch[2]);
      const styles: Record<number, string> = {
        1: "color:#2d3748;margin:22px 0 10px;font-size:20px;",
        2: "color:#2d3748;margin:22px 0 10px;font-size:18px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;",
        3: "color:#4a5568;margin:18px 0 8px;font-size:16px;",
        4: "color:#4a5568;margin:14px 0 6px;font-size:15px;",
        5: "color:#718096;margin:12px 0 4px;font-size:14px;",
        6: "color:#718096;margin:10px 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;",
      };
      const tag = level <= 2 ? "h2" : level <= 4 ? "h3" : "h4";
      outputLines.push(`<${tag} style="${styles[level]}">${text}</${tag}>`);
      continue;
    }

    // Unordered list items (- or *)
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (inOl) { outputLines.push("</ol>"); inOl = false; }
      if (!inUl) { outputLines.push('<ul style="padding-left:20px;margin:8px 0;">'); inUl = true; }
      outputLines.push(`<li style="margin:4px 0;">${inlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list items (1. 2. etc)
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inUl) { outputLines.push("</ul>"); inUl = false; }
      if (!inOl) { outputLines.push('<ol style="padding-left:20px;margin:8px 0;">'); inOl = true; }
      outputLines.push(`<li style="margin:4px 0;">${inlineMarkdown(olMatch[1])}</li>`);
      continue;
    }

    // Close any open lists
    if (inUl) { outputLines.push("</ul>"); inUl = false; }
    if (inOl) { outputLines.push("</ol>"); inOl = false; }

    // Empty line = paragraph break
    if (trimmed === "") {
      outputLines.push('<div style="margin:12px 0;"></div>');
      continue;
    }

    // Regular paragraph
    outputLines.push(`<p style="margin:6px 0;">${inlineMarkdown(trimmed)}</p>`);
  }

  if (inUl) outputLines.push("</ul>");
  if (inOl) outputLines.push("</ol>");

  const html = outputLines.join("\n");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:28px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;">${escapeHtml(title)}</h1>
    </div>
    <div style="padding:28px 32px;color:#2d3748;font-size:15px;line-height:1.7;">
      ${html}
    </div>
    <div style="padding:16px 32px;background:#f7fafc;border-top:1px solid #e2e8f0;text-align:center;color:#a0aec0;font-size:12px;">
      Cerebro — Your AI-powered knowledge brain
    </div>
  </div>
</body>
</html>`;
}

function inlineMarkdown(text: string): string {
  return text
    // Bold (must come before italic)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    // Inline code
    .replace(/`([^`]+)`/g, '<code style="background:#edf2f7;padding:2px 5px;border-radius:3px;font-size:13px;">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#667eea;">$1</a>')
    // Arrow entities
    .replace(/→/g, "→")
    .replace(/←/g, "←");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendDigestEmail(
  title: string,
  markdownContent: string,
): Promise<boolean> {
  if (!RESEND_API_KEY || !DIGEST_EMAIL_TO) return false;

  const htmlBody = markdownToHtml(markdownContent, title);
  const recipients = DIGEST_EMAIL_TO.split(",").map((e) => e.trim());

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: DIGEST_EMAIL_FROM,
        to: recipients,
        subject: title,
        html: htmlBody,
      }),
    });

    if (!r.ok) {
      const msg = await r.text().catch(() => "");
      console.error(`Resend email failed: ${r.status} ${msg}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email delivery error:", err);
    return false;
  }
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
  title: string,
  aiSummary: string,
): Promise<string[]> {
  const delivered: string[] = [];

  const teamsChannels = channels.filter(
    (ch) => ch.source === "teams" && ch.teams_service_url && ch.teams_conversation_id,
  );
  const discordChannels = channels.filter(
    (ch) => ch.source === "discord" && ch.discord_channel_id,
  );
  const imessageChannels = channels.filter(
    (ch) => ch.source === "imessage" && ch.imessage_chat_guid,
  );

  // Deliver to all channels + email in parallel
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

  for (const ch of imessageChannels) {
    if (!BLUEBUBBLES_URL || !BLUEBUBBLES_PASSWORD) continue;
    deliveryPromises.push(
      sendImessageMessage(ch.imessage_chat_guid!, digestText)
        .then((ok) => {
          if (ok) delivered.push(`imessage:${ch.imessage_chat_guid}`);
        }),
    );
  }

  // Email delivery via Resend
  if (RESEND_API_KEY && DIGEST_EMAIL_TO) {
    deliveryPromises.push(
      sendDigestEmail(title, aiSummary)
        .then((ok) => {
          if (ok) delivered.push(`email:${DIGEST_EMAIL_TO}`);
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
  const deliveredTo = await deliverDigest(channels, fullDigest, title, aiSummary);

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
  // Authenticate: accept x-brain-key, Authorization Bearer, or apikey header.
  // pg_cron scheduled calls send the Supabase service_role_key as Bearer token,
  // so we accept both BRAIN_KEY and SUPABASE_SERVICE_ROLE_KEY.
  const brainKey = Deno.env.get("BRAIN_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const providedKey =
    c.req.header("x-brain-key") ||
    c.req.header("authorization")?.replace("Bearer ", "") ||
    c.req.header("apikey");
  const validKeys = [brainKey, serviceRoleKey].filter(Boolean);
  if (!providedKey || !validKeys.includes(providedKey)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

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
  // Authenticate: accept x-brain-key, Authorization Bearer, or apikey header.
  // pg_cron scheduled calls send the Supabase service_role_key as Bearer token,
  // so we accept both BRAIN_KEY and SUPABASE_SERVICE_ROLE_KEY.
  const brainKey = Deno.env.get("BRAIN_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const providedKey =
    c.req.header("x-brain-key") ||
    c.req.header("authorization")?.replace("Bearer ", "") ||
    c.req.header("apikey");
  const validKeys = [brainKey, serviceRoleKey].filter(Boolean);
  if (!providedKey || !validKeys.includes(providedKey)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

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
