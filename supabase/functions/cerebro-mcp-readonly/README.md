# MCP Server (Read-Only)

A read-only Cerebro MCP server with OAuth authentication via Microsoft Entra ID. Provides search and browse access to your brain without write capabilities.

## Tools

| Tool | Description |
| ---- | ----------- |
| `search_thoughts` | Semantic similarity search — finds thoughts by meaning, not keywords |
| `list_thoughts` | Browse recent thoughts with optional filters (type, topic, person, days) |
| `thought_stats` | Summary statistics — totals, types, top topics, people mentioned |

> **No write tools.** This server cannot capture, complete, reopen, or delete thoughts. Use the primary `cerebro-mcp` server for write operations.

## Authentication

Uses **OAuth 2.1 with Microsoft Entra ID** for authentication. Entra ID issues tokens directly — the Edge Function validates them via JWKS. A Cloudflare Worker at a custom domain serves OAuth discovery documents at the domain root (required by the MCP OAuth spec).

### OAuth Flow

1. MCP client connects to `mcp.yourdomain.com` → proxied to Supabase → 401 with `WWW-Authenticate` header
2. Client discovers `/.well-known/oauth-protected-resource` at the domain root (served by Cloudflare Worker)
3. Client follows to Entra ID authorization server metadata
4. Client initiates Authorization Code + PKCE flow directly with Entra ID
5. User authenticates via Entra ID login
6. Entra ID issues access token with `Thoughts.Read` scope
7. Client uses Bearer token for all subsequent MCP requests (proxied through Worker to Supabase)

### Manual Token (for non-OAuth clients)

For clients that don't support the full OAuth flow, get a token via Azure CLI:

```bash
az account get-access-token --resource api://YOUR_CLIENT_ID --tenant YOUR_TENANT_ID --query accessToken -o tsv
```

Then pass it as a Bearer token in the `Authorization` header.

## Stack

- **Runtime:** Deno (Supabase Edge Functions)
- **Framework:** [Hono](https://hono.dev/) web framework
- **MCP Transport:** `@hono/mcp` StreamableHTTPTransport
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **JWT Validation:** `jose` (JWKS from Entra ID, RS256)
- **Database:** Supabase client (`@supabase/supabase-js`)
- **Validation:** Zod
- **OAuth Proxy:** Cloudflare Worker (serves discovery docs, proxies MCP requests)

## Environment Variables

Set via `npx supabase secrets set`:

| Variable | Source | Description |
| -------- | ------ | ----------- |
| `SUPABASE_URL` | Auto-provided | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided | Service role key for DB access |
| `OPENROUTER_API_KEY` | You set this | OpenRouter API key for search embeddings |
| `MCP_READONLY_TENANT_ID` | Entra ID | Your Entra ID tenant ID |
| `MCP_READONLY_CLIENT_ID` | Entra ID | App registration client ID |
| `MCP_READONLY_ALLOWED_USERS` | Optional | Comma-separated Entra ID user Object IDs to restrict access |

## Deployment

```bash
# Edge Function (Supabase)
cp integrations/mcp-server-readonly/index.ts supabase/functions/cerebro-mcp-readonly/index.ts
cp integrations/mcp-server-readonly/deno.json supabase/functions/cerebro-mcp-readonly/deno.json
npx supabase functions deploy cerebro-mcp-readonly --no-verify-jwt

# Cloudflare Worker (OAuth discovery proxy)
cd integrations/cloudflare-worker
npx wrangler deploy
```

## Connection URL

```text
https://mcp.yourdomain.com/
```

No `?key=` parameter needed — authentication happens via the OAuth flow.

## Endpoints

### Cloudflare Worker (mcp.yourdomain.com)

| Path | Method | Description |
| ---- | ------ | ----------- |
| `/.well-known/oauth-protected-resource` | GET | Protected Resource Metadata (RFC 9728) |
| `/.well-known/oauth-authorization-server` | GET | Auth server metadata (Entra ID endpoints) |
| `/.well-known/openid-configuration` | GET | OIDC discovery (proxied from Entra ID) |
| `*` | * | Proxied to Supabase Edge Function |

### Edge Function (cerebro-mcp-readonly)

| Path | Method | Description |
| ---- | ------ | ----------- |
| `/health` | GET | Health check |
| `*` | POST | MCP transport (requires Bearer token) |
