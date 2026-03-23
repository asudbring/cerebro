// Cloudflare Worker — OAuth discovery proxy for Cerebro MCP servers
//
// Serves OAuth discovery documents at the domain root so MCP clients (VS Code)
// can find Entra ID as the authorization server. Routes requests by path:
//   /rw/*  → primary cerebro-mcp Edge Function (read-write, 7 tools)
//   /*     → cerebro-mcp-readonly Edge Function (read-only, 3 tools)

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
        authorization_servers: [
          `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`,
        ],
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
      const entraBase = `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`;
      return Response.json({
        issuer: entraBase,
        authorization_endpoint: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/authorize`,
        token_endpoint: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/token`,
        jwks_uri: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
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

    // --- OpenID Connect Discovery (fallback) ---
    if (path === "/.well-known/openid-configuration") {
      const entraUrl = `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0/.well-known/openid-configuration`;
      const resp = await fetch(entraUrl);
      return new Response(resp.body, {
        status: resp.status,
        headers: corsHeaders(request),
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

    const target = new URL(backendBase + backendPath);
    target.search = url.search;

    const proxyHeaders = new Headers(request.headers);
    proxyHeaders.set("Host", new URL(env.SUPABASE_FUNCTION_URL).host);
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
    const wwwAuth = newHeaders.get("WWW-Authenticate");
    if (wwwAuth && resp.status === 401) {
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
  return {
    "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
    "Access-Control-Expose-Headers": "WWW-Authenticate",
    "Access-Control-Max-Age": "86400",
  };
}
