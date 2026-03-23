import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { Hono } from "hono";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import * as jose from "jose";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;

// Entra ID OAuth configuration
const ENTRA_TENANT_ID = Deno.env.get("MCP_READONLY_TENANT_ID")!;
const ENTRA_CLIENT_ID = Deno.env.get("MCP_READONLY_CLIENT_ID")!;

// Optional: comma-separated list of allowed Entra ID user Object IDs
const ALLOWED_USERS = Deno.env.get("MCP_READONLY_ALLOWED_USERS") || "";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const ENTRA_JWKS_URI = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/discovery/v2.0/keys`;
const ENTRA_ISSUER = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Cache JWKS for performance
let jwksCache: jose.JSONWebKeySet | null = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600_000; // 1 hour

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
): Promise<{ valid: boolean; sub?: string; name?: string; error?: string }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing Bearer token" };
  }
  const token = authHeader.slice(7);

  try {
    const jwks = jose.createLocalJWKSet(await getJWKS());
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: ENTRA_ISSUER,
      audience: [ENTRA_CLIENT_ID, `api://${ENTRA_CLIENT_ID}`],
    });

    const sub = (payload.oid || payload.sub) as string;
    const name = (payload as Record<string, unknown>).name as string ||
      (payload as Record<string, unknown>).preferred_username as string || "unknown";

    // Check allowed users if configured
    if (ALLOWED_USERS) {
      const allowed = ALLOWED_USERS.split(",").map((s) => s.trim());
      if (!allowed.includes(sub)) {
        return { valid: false, error: "User not authorized" };
      }
    }

    return { valid: true, sub, name };
  } catch (err) {
    return { valid: false, error: `Token validation failed: ${(err as Error).message}` };
  }
}

// ---------------------------------------------------------------------------
// Embeddings (read-only — only needed for search)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// MCP Server — Read-Only Tools
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "cerebro-readonly",
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
            parts.push(
              `📎 File: ${m.file_name || "attached"}${t.file_url ? " (saved)" : " (scanned only)"}`,
            );
          if (m.file_description)
            parts.push(
              `File summary: ${(m.file_description as string).slice(0, 200)}`,
            );
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
        .describe(
          "Filter by status. Defaults to 'open'. Use 'all' to include everything.",
        ),
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

// ---------------------------------------------------------------------------
// Hono App — MCP with Entra ID Bearer Token auth
// ---------------------------------------------------------------------------

const app = new Hono().basePath("/cerebro-mcp-readonly");

// Health check (public)
app.get("/health", (c) => {
  return c.json({ status: "ok", service: "cerebro-mcp-readonly", auth: "entra-id" });
});

// MCP Endpoints — Protected by Entra ID Bearer Token
app.all("*", async (c) => {
  const auth = c.req.header("Authorization");
  const result = await validateBearerToken(auth);

  if (!result.valid) {
    return c.json(
      { error: "unauthorized", message: result.error },
      {
        status: 401,
        headers: {
          "WWW-Authenticate":
            'Bearer resource_metadata="https://mcp.yourdomain.com/.well-known/oauth-protected-resource"',
        },
      },
    );
  }

  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

Deno.serve(app.fetch);
