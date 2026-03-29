// Cloudflare Worker — OAuth discovery proxy for Cerebro MCP servers
//
// Serves OAuth discovery documents at the domain root so MCP clients (VS Code,
// Claude Code, Open Code, etc.) can find Entra ID as the authorization server.
// Also implements RFC 7591 Dynamic Client Registration (DCR) stub so clients
// that require DCR (Claude Code, Open Code) can register without user friction.
// Routes requests by path:
//   /rw/*     → primary cerebro-mcp Edge Function (read-write, 7 tools)
//   /*        → cerebro-mcp-readonly Edge Function (read-only, 3 tools)
//   /register → DCR stub (serves pre-configured Entra client_id to all clients)

interface Env {
  SUPABASE_FUNCTION_URL: string;         // read-only Edge Function URL
  SUPABASE_RW_FUNCTION_URL: string;      // primary Edge Function URL
  ENTRA_TENANT_ID: string;
  ENTRA_CLIENT_ID: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = url.origin; // https://mcp.yourdomain.com

    // --- Protected Resource Metadata (RFC 9728) ---
    if (path === "/.well-known/oauth-protected-resource") {
      return Response.json({
        resource: origin,
        authorization_servers: [origin],
        scopes_supported: [
          `api://${env.ENTRA_CLIENT_ID}/Thoughts.Read`,
          `api://${env.ENTRA_CLIENT_ID}/Thoughts.ReadWrite`,
        ],
        bearer_methods_supported: ["header"],
      }, {
        headers: corsHeaders(request),
      });
    }

    // --- OAuth Authorization Server Metadata (RFC 8414) ---
    if (path === "/.well-known/oauth-authorization-server") {
      return Response.json({
        issuer: origin,
        authorization_endpoint: `${origin}/oauth/authorize`,
        token_endpoint: `${origin}/oauth/token`,
        jwks_uri: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
        registration_endpoint: `${origin}/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
        scopes_supported: [
          `api://${env.ENTRA_CLIENT_ID}/Thoughts.Read`,
          `api://${env.ENTRA_CLIENT_ID}/Thoughts.ReadWrite`,
        ],
      }, {
        headers: corsHeaders(request),
      });
    }

    // --- Dynamic Client Registration (RFC 7591) ---
    // Claude Code, Open Code, and other MCP clients call POST /register before
    // initiating the OAuth flow. Since Entra ID doesn't support DCR natively,
    // we return the pre-configured Entra public client_id for every request.
    // All clients share the same Entra app (PKCE, no client secret needed).
    if (path === "/register" && request.method === "POST") {
      let body: Record<string, unknown> = {};
      try {
        const text = await request.text();
        if (text) body = JSON.parse(text);
      } catch { /* empty or non-JSON body is acceptable */ }

      const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
      // Echo back grant_types from the request; default to authorization_code only
      const grantTypes = Array.isArray(body.grant_types) && body.grant_types.length
        ? body.grant_types
        : ["authorization_code"];

      return Response.json({
        client_id: env.ENTRA_CLIENT_ID,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        token_endpoint_auth_method: "none",
        grant_types: grantTypes,
        response_types: ["code"],
        redirect_uris: redirectUris,
        code_challenge_methods_supported: ["S256"],
      }, {
        status: 201,
        headers: corsHeaders(request),
      });
    }

    // --- OpenID Connect Discovery (fallback) ---
    if (path === "/.well-known/openid-configuration") {
      const entraUrl = `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0/.well-known/openid-configuration`;
      const resp = await fetch(entraUrl);
      return new Response(resp.body, {
        status: resp.status,
        headers: corsHeaders(request),
      });
    }

    // --- OAuth Authorization Proxy ---
    // Strips the `resource` parameter before redirecting to Entra.
    // The MCP SDK sends resource=<origin> (required by RFC 9728 matching), but
    // Entra v2.0 rejects it unless it matches the scope audience (api://client-id).
    // Solution: proxy through here and drop the resource param.
    if (path === "/oauth/authorize") {
      const entraUrl = new URL(
        `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/authorize`
      );
      for (const [key, value] of url.searchParams) {
        if (key !== "resource") entraUrl.searchParams.set(key, value);
      }
      return Response.redirect(entraUrl.toString(), 302);
    }

    // --- OAuth Token Proxy ---
    // Same resource-stripping logic for the token endpoint.
    if (path === "/oauth/token" && request.method === "POST") {
      const body = await request.text();
      const params = new URLSearchParams(body);
      params.delete("resource");
      const entraTokenUrl = `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/token`;
      const resp = await fetch(entraTokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      return new Response(resp.body, {
        status: resp.status,
        headers: { ...Object.fromEntries(resp.headers), ...corsHeaders(request) },
      });
    }

    // --- CORS preflight ---
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // --- Route to correct backend ---
    // /rw/* → primary cerebro-mcp (read-write)
    // /*    → cerebro-mcp-readonly
    const isRW = path.startsWith("/rw");
    const backendBase = isRW ? env.SUPABASE_RW_FUNCTION_URL : env.SUPABASE_FUNCTION_URL;
    // Strip /rw prefix for the backend path
    const backendPath = isRW ? path.replace(/^\/rw/, "") || "/" : path;

    // Reject path traversal attempts
    if (backendPath.includes("..")) {
      return new Response("Invalid path", { status: 400 });
    }

    const target = new URL(backendBase + backendPath);
    target.search = url.search;

    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set("Host", new URL(backendBase).host);
    // Pass through the original origin for CORS
    proxyHeaders.set("X-Forwarded-Host", url.host);
    proxyHeaders.set("X-Forwarded-Proto", "https");

    const resp = await fetch(target.toString(), {
      method: request.method,
      headers: proxyHeaders,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    });

    // Rewrite the resource_metadata URL in 401 responses to use our domain
    const newHeaders = new Headers(resp.headers);
    if (resp.status === 401) {
      newHeaders.set(
        "WWW-Authenticate",
        `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
      );
    }
    // Add CORS headers to proxied responses
    for (const [k, v] of Object.entries(corsHeaders(request))) {
      newHeaders.set(k, v);
    }

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: newHeaders,
    });
  },
};

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowed = [
    "https://vscode.dev",
    "https://insiders.vscode.dev",
    "https://github.dev",
    "null",  // VS Code desktop sends null origin
  ];
  // Allow any origin from vscode extensions or localhost
  const isAllowed = allowed.includes(origin)
    || origin.startsWith("vscode-webview://")
    || origin.startsWith("http://localhost")
    || origin.startsWith("http://127.0.0.1");

  const allowOrigin = origin
    ? (isAllowed ? origin : "")
    : "*";  // No Origin header → non-browser client, allow

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
    "Access-Control-Expose-Headers": "WWW-Authenticate",
    "Access-Control-Max-Age": "86400",
  };
}
