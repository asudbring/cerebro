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

// Signing secret for server-issued tokens
const SIGNING_SECRET = Deno.env.get("MCP_READONLY_SIGNING_SECRET")!;

// Optional: comma-separated list of allowed Entra ID user Object IDs
const ALLOWED_USERS = Deno.env.get("MCP_READONLY_ALLOWED_USERS") || "";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const ENTRA_BASE = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}`;
const ENTRA_JWKS_URI = `${ENTRA_BASE}/discovery/v2.0/keys`;
const ENTRA_ISSUER = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Cache JWKS for performance
let jwksCache: jose.JSONWebKeySet | null = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600_000; // 1 hour

// In-memory dynamic client registration store
const registeredClients = new Map<
  string,
  { client_id: string; client_name?: string; redirect_uris: string[] }
>();

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

async function validateEntraToken(token: string): Promise<jose.JWTPayload> {
  const jwks = jose.createLocalJWKSet(await getJWKS());
  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer: ENTRA_ISSUER,
    audience: ENTRA_CLIENT_ID,
  });
  return payload;
}

async function validateServerToken(token: string): Promise<jose.JWTPayload> {
  const secret = new TextEncoder().encode(SIGNING_SECRET);
  const { payload } = await jose.jwtVerify(token, secret, {
    issuer: "cerebro-mcp-readonly",
  });
  return payload;
}

async function issueServerToken(
  sub: string,
  name: string,
): Promise<{ access_token: string; expires_in: number }> {
  const secret = new TextEncoder().encode(SIGNING_SECRET);
  const expiresIn = 3600; // 1 hour
  const token = await new jose.SignJWT({ sub, name })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("cerebro-mcp-readonly")
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret);
  return { access_token: token, expires_in: expiresIn };
}

async function validateBearerToken(
  authHeader: string | undefined,
): Promise<{ valid: boolean; sub?: string; name?: string; error?: string }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing Bearer token" };
  }
  const token = authHeader.slice(7);

  // Try server-issued token first, then Entra ID token
  try {
    const payload = await validateServerToken(token);
    return {
      valid: true,
      sub: payload.sub,
      name: (payload as Record<string, unknown>).name as string,
    };
  } catch {
    // Not a server token — try Entra ID token directly
  }

  try {
    const payload = await validateEntraToken(token);
    const sub = payload.sub || payload.oid as string;
    const name = (payload as Record<string, unknown>).name as string ||
      (payload as Record<string, unknown>).preferred_username as string || "unknown";

    // Check allowed users if configured
    if (ALLOWED_USERS) {
      const allowed = ALLOWED_USERS.split(",").map((s) => s.trim());
      const oid = (payload.oid || payload.sub) as string;
      if (!allowed.includes(oid)) {
        return { valid: false, error: "User not authorized" };
      }
    }

    return { valid: true, sub, name };
  } catch (err) {
    return { valid: false, error: `Token validation failed: ${(err as Error).message}` };
  }
}

function getBaseUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}`;
}

function getFunctionPath(requestUrl: string): string {
  const url = new URL(requestUrl);
  // Extract the function base path (e.g., /functions/v1/cerebro-mcp-readonly)
  const match = url.pathname.match(/^(\/functions\/v1\/[^/]+)/);
  return match ? match[1] : url.pathname;
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
// Hono App — OAuth + MCP
// ---------------------------------------------------------------------------

const app = new Hono();

// Health check
app.get("/functions/v1/cerebro-mcp-readonly/health", (c) => {
  return c.json({ status: "ok", service: "cerebro-mcp-readonly", auth: "oauth" });
});

// ---------------------------------------------------------------------------
// OAuth Authorization Server Metadata (RFC 8414)
// ---------------------------------------------------------------------------

app.get(
  "/functions/v1/cerebro-mcp-readonly/.well-known/oauth-authorization-server",
  (c) => {
    const base = getBaseUrl(c.req.url);
    const fnPath = `${base}/functions/v1/cerebro-mcp-readonly`;
    return c.json({
      issuer: fnPath,
      authorization_endpoint: `${fnPath}/authorize`,
      token_endpoint: `${fnPath}/token`,
      registration_endpoint: `${fnPath}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["openid", "profile"],
    });
  },
);

// Serve metadata at root-relative path too (for spec-compliant clients)
app.get("/.well-known/oauth-authorization-server", (c) => {
  const base = getBaseUrl(c.req.url);
  const fnPath = `${base}/functions/v1/cerebro-mcp-readonly`;
  return c.json({
    issuer: fnPath,
    authorization_endpoint: `${fnPath}/authorize`,
    token_endpoint: `${fnPath}/token`,
    registration_endpoint: `${fnPath}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["openid", "profile"],
  });
});

// ---------------------------------------------------------------------------
// Dynamic Client Registration (RFC 7591)
// ---------------------------------------------------------------------------

app.post("/functions/v1/cerebro-mcp-readonly/register", async (c) => {
  try {
    const body = await c.req.json();
    const clientId = crypto.randomUUID();
    const client = {
      client_id: clientId,
      client_name: body.client_name || "MCP Client",
      redirect_uris: body.redirect_uris || ["http://localhost/callback"],
    };
    registeredClients.set(clientId, client);
    return c.json({
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }, 201);
  } catch {
    return c.json({ error: "invalid_client_metadata" }, 400);
  }
});

// ---------------------------------------------------------------------------
// Authorization Endpoint — Redirect to Entra ID
// ---------------------------------------------------------------------------

// In-memory store for pending authorization codes
const pendingCodes = new Map<
  string,
  {
    entraCode: string;
    redirectUri: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    clientId: string;
    expiresAt: number;
  }
>();

app.get("/functions/v1/cerebro-mcp-readonly/authorize", (c) => {
  const url = new URL(c.req.url);
  const clientId = url.searchParams.get("client_id") || "";
  const redirectUri = url.searchParams.get("redirect_uri") || "http://localhost/callback";
  const state = url.searchParams.get("state") || "";
  const codeChallenge = url.searchParams.get("code_challenge") || "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "S256";
  const scope = url.searchParams.get("scope") || "openid profile";

  // Build state that encodes our metadata so the callback can reconstruct
  const serverState = btoa(
    JSON.stringify({
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      originalState: state,
    }),
  );

  const base = getBaseUrl(c.req.url);
  const callbackUrl = `${base}/functions/v1/cerebro-mcp-readonly/callback`;

  // Redirect to Entra ID authorization endpoint
  const entraAuthUrl = new URL(`${ENTRA_BASE}/oauth2/v2.0/authorize`);
  entraAuthUrl.searchParams.set("client_id", ENTRA_CLIENT_ID);
  entraAuthUrl.searchParams.set("response_type", "code");
  entraAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  entraAuthUrl.searchParams.set("scope", "openid profile email");
  entraAuthUrl.searchParams.set("state", serverState);
  entraAuthUrl.searchParams.set("response_mode", "query");

  return c.redirect(entraAuthUrl.toString());
});

// ---------------------------------------------------------------------------
// OAuth Callback — Entra ID redirects here after user login
// ---------------------------------------------------------------------------

app.get("/functions/v1/cerebro-mcp-readonly/callback", async (c) => {
  const url = new URL(c.req.url);
  const entraCode = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state") || "";
  const error = url.searchParams.get("error");

  if (error) {
    const errorDesc = url.searchParams.get("error_description") || "";
    return c.text(`Authorization failed: ${error} - ${errorDesc}`, 400);
  }

  if (!entraCode) {
    return c.text("Missing authorization code", 400);
  }

  // Decode the state to get the original client info
  let stateData: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    originalState: string;
  };
  try {
    stateData = JSON.parse(atob(stateParam));
  } catch {
    return c.text("Invalid state parameter", 400);
  }

  // Exchange Entra ID code for tokens to validate the user
  const base = getBaseUrl(c.req.url);
  const callbackUrl = `${base}/functions/v1/cerebro-mcp-readonly/callback`;

  const tokenResp = await fetch(`${ENTRA_BASE}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENTRA_CLIENT_ID,
      grant_type: "authorization_code",
      code: entraCode,
      redirect_uri: callbackUrl,
      scope: "openid profile email",
    }),
  });

  if (!tokenResp.ok) {
    const errBody = await tokenResp.text();
    return c.text(`Token exchange failed: ${errBody}`, 500);
  }

  const tokenData = await tokenResp.json();
  const idToken = tokenData.id_token;

  // Validate the ID token to get user info
  let userPayload: jose.JWTPayload;
  try {
    const jwks = jose.createLocalJWKSet(await getJWKS());
    const { payload } = await jose.jwtVerify(idToken, jwks, {
      issuer: ENTRA_ISSUER,
      audience: ENTRA_CLIENT_ID,
    });
    userPayload = payload;
  } catch (err) {
    return c.text(`ID token validation failed: ${(err as Error).message}`, 500);
  }

  // Check allowed users
  const oid = (userPayload.oid || userPayload.sub) as string;
  if (ALLOWED_USERS) {
    const allowed = ALLOWED_USERS.split(",").map((s) => s.trim());
    if (!allowed.includes(oid)) {
      return c.text("User not authorized for this MCP server", 403);
    }
  }

  // Generate a short-lived server authorization code
  const serverCode = crypto.randomUUID();
  pendingCodes.set(serverCode, {
    entraCode,
    redirectUri: stateData.redirectUri,
    codeChallenge: stateData.codeChallenge,
    codeChallengeMethod: stateData.codeChallengeMethod,
    clientId: stateData.clientId,
    expiresAt: Date.now() + 300_000, // 5 minutes
  });

  // Store user info for token issuance
  pendingCodes.set(`user:${serverCode}`, {
    entraCode: oid,
    redirectUri: (userPayload as Record<string, unknown>).name as string ||
      (userPayload as Record<string, unknown>).preferred_username as string || "user",
    codeChallenge: "",
    codeChallengeMethod: "",
    clientId: "",
    expiresAt: Date.now() + 300_000,
  });

  // Redirect back to the MCP client with our server code
  const clientRedirect = new URL(stateData.redirectUri);
  clientRedirect.searchParams.set("code", serverCode);
  if (stateData.originalState) {
    clientRedirect.searchParams.set("state", stateData.originalState);
  }

  return c.redirect(clientRedirect.toString());
});

// ---------------------------------------------------------------------------
// Token Endpoint — Exchange server code for access token
// ---------------------------------------------------------------------------

app.post("/functions/v1/cerebro-mcp-readonly/token", async (c) => {
  const body = await c.req.parseBody();
  const grantType = body.grant_type as string;
  const code = body.code as string;
  const codeVerifier = body.code_verifier as string;

  if (grantType !== "authorization_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  if (!code) {
    return c.json({ error: "invalid_request", error_description: "Missing code" }, 400);
  }

  const pending = pendingCodes.get(code);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingCodes.delete(code);
    return c.json({ error: "invalid_grant", error_description: "Code expired or invalid" }, 400);
  }

  // Verify PKCE code_verifier if code_challenge was provided
  if (pending.codeChallenge && codeVerifier) {
    const encoder = new TextEncoder();
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
    const computed = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    if (computed !== pending.codeChallenge) {
      pendingCodes.delete(code);
      return c.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
    }
  }

  // Get stored user info
  const userInfo = pendingCodes.get(`user:${code}`);
  const sub = userInfo?.entraCode || "unknown";
  const name = userInfo?.redirectUri || "user";

  // Clean up
  pendingCodes.delete(code);
  pendingCodes.delete(`user:${code}`);

  // Issue server access token
  const { access_token, expires_in } = await issueServerToken(sub, name);

  return c.json({
    access_token,
    token_type: "Bearer",
    expires_in,
  });
});

// ---------------------------------------------------------------------------
// MCP Endpoints — Protected by Bearer Token
// ---------------------------------------------------------------------------

app.all("*", async (c) => {
  // Check for Bearer token
  const auth = c.req.header("Authorization");
  const result = await validateBearerToken(auth);

  if (!result.valid) {
    const base = getBaseUrl(c.req.url);
    const fnPath = `${base}/functions/v1/cerebro-mcp-readonly`;
    return c.json(
      { error: "unauthorized", message: result.error },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": `Bearer resource_metadata="${fnPath}/.well-known/oauth-authorization-server"`,
        },
      },
    );
  }

  const transport = new StreamableHTTPTransport();
  await server.connect(transport);
  return transport.handleRequest(c);
});

Deno.serve(app.fetch);
