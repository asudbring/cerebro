import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import * as jose from "jose";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const MCP_ACCESS_KEY = Deno.env.get("MCP_ACCESS_KEY")!;

// Entra ID OAuth configuration (optional — enables Bearer token auth)
const ENTRA_TENANT_ID = Deno.env.get("MCP_READONLY_TENANT_ID") || "";
const ENTRA_CLIENT_ID = Deno.env.get("MCP_READONLY_CLIENT_ID") || "";
const ENTRA_JWKS_URI = ENTRA_TENANT_ID
  ? `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/discovery/v2.0/keys`
  : "";
const ENTRA_ISSUER = ENTRA_TENANT_ID
  ? `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0`
  : "";

// JWKS cache for Bearer token validation
let jwksCache: jose.JSONWebKeySet | null = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600_000; // 1 hour

async function getJWKS(): Promise<jose.JSONWebKeySet> {
  if (jwksCache && Date.now() - jwksCacheTime < JWKS_CACHE_TTL) {
    return jwksCache;
  }
  const r = await fetch(ENTRA_JWKS_URI);
  if (!r.ok) throw new Error(`Failed to fetch JWKS: ${r.status}`);
  jwksCache = await r.json();
  jwksCacheTime = Date.now();
  return jwksCache!;
}

async function validateBearerToken(
  authHeader: string | undefined,
): Promise<{ valid: boolean; error?: string }> {
  if (!ENTRA_TENANT_ID || !ENTRA_CLIENT_ID) {
    return { valid: false, error: "OAuth not configured" };
  }
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing Bearer token" };
  }
  const token = authHeader.slice(7);
  try {
    const jwks = jose.createLocalJWKSet(await getJWKS());
    await jose.jwtVerify(token, jwks, {
      issuer: ENTRA_ISSUER,
      audience: [ENTRA_CLIENT_ID, `api://${ENTRA_CLIENT_ID}`],
    });
    return { valid: true };
  } catch (err) {
    return { valid: false, error: `Token validation failed: ${(err as Error).message}` };
  }
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

// ---------------------------------------------------------------------------
// Calendar Reminder Creation
// ---------------------------------------------------------------------------

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

async function createO365Event(
  title: string,
  datetime: string,
  body: string,
): Promise<boolean> {
  const userEmail = Deno.env.get("CALENDAR_USER_EMAIL");
  const token = await getGraphToken();
  if (!token || !userEmail) return false;

  const startTime = new Date(datetime);
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 min

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

  // Build JWT header + claim
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const claim = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const signingInput = `${header}.${claim}`;

  // Import RSA private key
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
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${signingInput}.${sigB64}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
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

  const startTime = new Date(datetime);
  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

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
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
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

  if (o365) created.push("O365");
  if (google) created.push("Google");
  return created;
}

// --- MCP Server Setup ---

const server = new McpServer({
  name: "cerebro",
  version: "1.0.0",
});

// Tool 1: Semantic Search
server.registerTool(
  "search_thoughts",
  {
    title: "Search Thoughts",
    description:
      "Search captured thoughts by meaning. Use this when the user asks about a topic, person, or idea they've previously captured. Note: deleted thoughts may appear in results — use list_thoughts for filtered views.",
    inputSchema: {
      query: z.string().describe("What to search for"),
      limit: z.number().optional().default(10),
      threshold: z.number().optional().default(0.5),
    },
  },
  async ({ query, limit, threshold }) => {
    try {
      const qEmb = await getEmbedding(query);
      const { data, error } = await supabase.rpc("match_thoughts", {
        query_embedding: qEmb,
        match_threshold: threshold,
        match_count: limit,
        filter: {},
      });

      if (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Search error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }

      if (!data || data.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No thoughts found matching "${query}".`,
            },
          ],
        };
      }

      const results = data.map(
        (
          t: {
            content: string;
            metadata: Record<string, unknown>;
            similarity: number;
            created_at: string;
            file_url?: string;
            file_type?: string;
          },
          i: number,
        ) => {
          const m = t.metadata || {};
          const parts = [
            `--- Result ${i + 1} (${(t.similarity * 100).toFixed(1)}% match) ---`,
            `Captured: ${new Date(t.created_at).toLocaleDateString()}`,
            `Type: ${m.type || "unknown"}`,
          ];
          if (Array.isArray(m.topics) && m.topics.length)
            parts.push(`Topics: ${(m.topics as string[]).join(", ")}`);
          if (Array.isArray(m.people) && m.people.length)
            parts.push(`People: ${(m.people as string[]).join(", ")}`);
          if (Array.isArray(m.action_items) && m.action_items.length)
            parts.push(
              `Actions: ${(m.action_items as string[]).join("; ")}`,
            );
          if (m.has_file)
            parts.push(`📎 File: ${m.file_name || "attached"}${t.file_url ? " (saved)" : " (scanned only)"}`);
          if (m.file_description)
            parts.push(`File summary: ${(m.file_description as string).slice(0, 200)}`);
          parts.push(`\n${t.content}`);
          return parts.join("\n");
        },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${data.length} thought(s):\n\n${results.join("\n\n")}`,
          },
        ],
      };
    } catch (err: unknown) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 2: List Recent
server.registerTool(
  "list_thoughts",
  {
    title: "List Recent Thoughts",
    description:
      "List recently captured thoughts with optional filters by type, topic, person, or time range.",
    inputSchema: {
      limit: z.number().optional().default(10),
      type: z
        .string()
        .optional()
        .describe(
          "Filter by type: observation, task, idea, reference, person_note",
        ),
      topic: z.string().optional().describe("Filter by topic tag"),
      person: z.string().optional().describe("Filter by person mentioned"),
      days: z
        .number()
        .optional()
        .describe("Only thoughts from the last N days"),
      has_file: z
        .boolean()
        .optional()
        .describe("Filter to only thoughts with file attachments"),
      status: z
        .enum(["open", "done", "deleted", "all"])
        .optional()
        .default("open")
        .describe("Filter by status. Defaults to 'open'. Use 'all' to include everything."),
    },
  },
  async ({ limit, type, topic, person, days, has_file, status }) => {
    try {
      let q = supabase
        .from("thoughts")
        .select("content, metadata, created_at, file_url, file_type, status")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status !== "all") q = q.eq("status", status);
      if (type) q = q.contains("metadata", { type });
      if (topic) q = q.contains("metadata", { topics: [topic] });
      if (person) q = q.contains("metadata", { people: [person] });
      if (has_file) q = q.contains("metadata", { has_file: true });
      if (days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        q = q.gte("created_at", since.toISOString());
      }

      const { data, error } = await q;

      if (error) {
        return {
          content: [
            { type: "text" as const, text: `Error: ${error.message}` },
          ],
          isError: true,
        };
      }

      if (!data || !data.length) {
        return {
          content: [
            { type: "text" as const, text: "No thoughts found." },
          ],
        };
      }

      const results = data.map(
        (
          t: {
            content: string;
            metadata: Record<string, unknown>;
            created_at: string;
            file_url?: string;
            file_type?: string;
          },
          i: number,
        ) => {
          const m = t.metadata || {};
          const tags = Array.isArray(m.topics)
            ? (m.topics as string[]).join(", ")
            : "";
          const fileTag = m.has_file
            ? ` 📎${t.file_url ? "" : " (scan only)"}`
            : "";
          return `${i + 1}. [${new Date(t.created_at).toLocaleDateString()}] (${m.type || "??"}${tags ? " - " + tags : ""}${fileTag})\n   ${t.content}`;
        },
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.length} recent thought(s):\n\n${results.join("\n\n")}`,
          },
        ],
      };
    } catch (err: unknown) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 3: Stats
server.registerTool(
  "thought_stats",
  {
    title: "Thought Statistics",
    description:
      "Get a summary of all captured thoughts: totals, types, top topics, and people.",
    inputSchema: {},
  },
  async () => {
    try {
      const { count } = await supabase
        .from("thoughts")
        .select("*", { count: "exact", head: true });

      const { data } = await supabase
        .from("thoughts")
        .select("metadata, created_at")
        .order("created_at", { ascending: false });

      const types: Record<string, number> = {};
      const topics: Record<string, number> = {};
      const people: Record<string, number> = {};

      for (const r of data || []) {
        const m = (r.metadata || {}) as Record<string, unknown>;
        if (m.type)
          types[m.type as string] = (types[m.type as string] || 0) + 1;
        if (Array.isArray(m.topics))
          for (const t of m.topics)
            topics[t as string] = (topics[t as string] || 0) + 1;
        if (Array.isArray(m.people))
          for (const p of m.people)
            people[p as string] = (people[p as string] || 0) + 1;
      }

      const sort = (o: Record<string, number>): [string, number][] =>
        Object.entries(o)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

      const lines: string[] = [
        `Total thoughts: ${count}`,
        `Date range: ${
          data?.length
            ? new Date(
                data[data.length - 1].created_at,
              ).toLocaleDateString() +
              " → " +
              new Date(data[0].created_at).toLocaleDateString()
            : "N/A"
        }`,
        "",
        "Types:",
        ...sort(types).map(([k, v]) => `  ${k}: ${v}`),
      ];

      if (Object.keys(topics).length) {
        lines.push("", "Top topics:");
        for (const [k, v] of sort(topics)) lines.push(`  ${k}: ${v}`);
      }

      if (Object.keys(people).length) {
        lines.push("", "People mentioned:");
        for (const [k, v] of sort(people)) lines.push(`  ${k}: ${v}`);
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (err: unknown) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 4: Capture Thought
server.registerTool(
  "capture_thought",
  {
    title: "Capture Thought",
    description:
      "Save a new thought to Cerebro. Generates an embedding and extracts metadata automatically. Use this when the user wants to save something to their brain — notes, insights, decisions, or migrated content.",
    inputSchema: {
      content: z
        .string()
        .describe(
          "The thought to capture — a clear, standalone statement that will make sense when retrieved later by any AI",
        ),
    },
  },
  async ({ content }) => {
    try {
      const [embedding, metadata] = await Promise.all([
        getEmbedding(content),
        extractMetadata(content),
      ]);

      const { error } = await supabase.from("thoughts").insert({
        content,
        embedding,
        metadata: { ...metadata, source: "mcp" },
      });

      if (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to capture: ${error.message}`,
            },
          ],
          isError: true,
        };
      }

      const meta = metadata as Record<string, unknown>;
      let confirmation = `Captured as ${meta.type || "thought"}`;
      if (Array.isArray(meta.topics) && meta.topics.length)
        confirmation += ` — ${(meta.topics as string[]).join(", ")}`;
      if (Array.isArray(meta.people) && meta.people.length)
        confirmation += ` | People: ${(meta.people as string[]).join(", ")}`;
      if (Array.isArray(meta.action_items) && meta.action_items.length)
        confirmation += ` | Actions: ${(meta.action_items as string[]).join("; ")}`;

      // Create calendar reminders if detected
      const calendars = await createCalendarReminders(meta, content);
      if (calendars.length) {
        confirmation += ` | ⏰ Reminder created on ${calendars.join(" + ")}`;
      } else if (meta.has_reminder) {
        confirmation += ` | ⏰ Reminder detected but no calendar configured`;
      }

      return {
        content: [{ type: "text" as const, text: confirmation }],
      };
    } catch (err: unknown) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Tool 5: Complete Task
server.registerTool(
  "complete_task",
  {
    title: "Complete Task",
    description: "Mark a task as done by describing it. Uses semantic matching to find the right task.",
    inputSchema: {
      description: z.string().describe("Description of the task to mark as done"),
    },
  },
  async ({ description }) => {
    try {
      const embedding = await getEmbedding(description);
      const { data, error } = await supabase.rpc("match_thoughts", {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 5,
        filter: {},
      });

      if (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      }

      // Find the best matching open task
      const task = data?.find(
        (r: { metadata: Record<string, unknown>; similarity: number }) =>
          r.metadata?.type === "task" && (!r.metadata?.status || r.metadata?.status !== "done")
      );

      // NOTE: match_thoughts returns metadata but we need to check the real status column too
      // Re-query the specific thought to check column status
      if (task) {
        const { data: thought } = await supabase
          .from("thoughts")
          .select("id, content, metadata, status")
          .eq("id", task.id)
          .single();

        if (thought && thought.status !== "done" && thought.status !== "deleted") {
          await supabase.from("thoughts").update({ status: "done" }).eq("id", thought.id);
          const title = (thought.metadata as Record<string, unknown>)?.title || thought.content.slice(0, 60);
          return {
            content: [{ type: "text" as const, text: `✅ **Marked done:** ${title}\n(${(task.similarity * 100).toFixed(0)}% match)` }],
          };
        }
      }

      return {
        content: [{ type: "text" as const, text: `No matching open task found for "${description}".` }],
      };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

// Tool 6: Reopen Task
server.registerTool(
  "reopen_task",
  {
    title: "Reopen Task",
    description: "Reopen a completed task by describing it. Uses semantic matching.",
    inputSchema: {
      description: z.string().describe("Description of the completed task to reopen"),
    },
  },
  async ({ description }) => {
    try {
      const embedding = await getEmbedding(description);
      const { data, error } = await supabase.rpc("match_thoughts", {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 5,
        filter: {},
      });

      if (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      }

      // Find the best matching done task
      for (const r of data || []) {
        const { data: thought } = await supabase
          .from("thoughts")
          .select("id, content, metadata, status")
          .eq("id", r.id)
          .single();

        if (thought && thought.status === "done" && (thought.metadata as Record<string, unknown>)?.type === "task") {
          await supabase.from("thoughts").update({ status: "open" }).eq("id", thought.id);
          const title = (thought.metadata as Record<string, unknown>)?.title || thought.content.slice(0, 60);
          return {
            content: [{ type: "text" as const, text: `🔄 **Reopened:** ${title}\n(${(r.similarity * 100).toFixed(0)}% match)` }],
          };
        }
      }

      return {
        content: [{ type: "text" as const, text: `No matching completed task found for "${description}".` }],
      };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

// Tool 7: Delete Thought
server.registerTool(
  "delete_task",
  {
    title: "Delete Thought",
    description: "Soft-delete a thought or task by describing it. The thought is hidden but not permanently removed.",
    inputSchema: {
      description: z.string().describe("Description of the thought or task to delete"),
    },
  },
  async ({ description }) => {
    try {
      const embedding = await getEmbedding(description);
      const { data, error } = await supabase.rpc("match_thoughts", {
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 5,
        filter: {},
      });

      if (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error.message}` }], isError: true };
      }

      // Find the best matching non-deleted thought
      for (const r of data || []) {
        const { data: thought } = await supabase
          .from("thoughts")
          .select("id, content, metadata, status")
          .eq("id", r.id)
          .single();

        if (thought && thought.status !== "deleted") {
          await supabase.from("thoughts").update({ status: "deleted" }).eq("id", thought.id);
          const title = (thought.metadata as Record<string, unknown>)?.title || thought.content.slice(0, 60);
          return {
            content: [{ type: "text" as const, text: `🗑️ **Deleted:** ${title}\n(${(r.similarity * 100).toFixed(0)}% match)` }],
          };
        }
      }

      return {
        content: [{ type: "text" as const, text: `No matching thought found for "${description}".` }],
      };
    } catch (err: unknown) {
      return { content: [{ type: "text" as const, text: `Error: ${(err as Error).message}` }], isError: true };
    }
  },
);

// --- Hono App with Auth Check ---

const app = new Hono();

app.all("*", async (c) => {
  let authenticated = false;

  // Try OAuth Bearer token first
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const result = await validateBearerToken(authHeader);
    authenticated = result.valid;
  }

  // Fall back to x-brain-key (header or query param)
  if (!authenticated) {
    const apiKey =
      c.req.header("x-brain-key") ||
      new URL(c.req.url).searchParams.get("key");
    if (apiKey && apiKey === MCP_ACCESS_KEY) {
      authenticated = true;
    }
  }

  if (!authenticated) {
    return c.json(
      { error: "unauthorized", message: "Missing Bearer token" },
      401,
      {
        "WWW-Authenticate":
          'Bearer resource_metadata="https://mcp.yourdomain.com/.well-known/oauth-protected-resource"',
      },
    );
  }

  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

Deno.serve(app.fetch);
