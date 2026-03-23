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

Uses **OAuth 2.1 with Microsoft Entra ID** instead of a static access key. The server acts as its own OAuth authorization server, delegating user authentication to your Entra ID tenant.

### OAuth Flow

1. MCP client connects → server returns 401 with metadata pointer
2. Client discovers OAuth endpoints via `/.well-known/oauth-authorization-server`
3. Client initiates Authorization Code + PKCE flow
4. Server redirects to Entra ID for user login
5. User authenticates → Entra ID redirects back to server with auth code
6. Server exchanges code, validates user, issues its own access token
7. Client uses Bearer token for all subsequent MCP requests

### Manual Token (for non-OAuth clients)

For clients that don't support the full OAuth flow, get a token via Azure CLI:

```bash
az account get-access-token --resource YOUR_ENTRA_CLIENT_ID --query accessToken -o tsv
```

Then pass it as a Bearer token in the `Authorization` header.

## Stack

- **Runtime:** Deno (Supabase Edge Functions)
- **Framework:** [Hono](https://hono.dev/) web framework
- **MCP Transport:** `@hono/mcp` StreamableHTTPTransport
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **JWT Validation:** `jose` (JWKS, JWT verify, token signing)
- **Database:** Supabase client (`@supabase/supabase-js`)
- **Validation:** Zod

## Environment Variables

Set via `supabase secrets set`:

| Variable | Source | Description |
| -------- | ------ | ----------- |
| `SUPABASE_URL` | Auto-provided | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided | Service role key for DB access |
| `OPENROUTER_API_KEY` | You set this | OpenRouter API key for search embeddings |
| `MCP_READONLY_TENANT_ID` | Entra ID | Your Entra ID tenant ID |
| `MCP_READONLY_CLIENT_ID` | Entra ID | App registration client ID |
| `MCP_READONLY_SIGNING_SECRET` | You generate | Secret for signing server-issued JWT tokens |
| `MCP_READONLY_ALLOWED_USERS` | Optional | Comma-separated Entra ID user Object IDs to restrict access |

## Deployment

```bash
# From your Supabase project directory
supabase functions deploy cerebro-mcp-readonly --no-verify-jwt
```

## Connection URL

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp-readonly
```

No `?key=` parameter needed — authentication happens via the OAuth flow.

## Endpoints

| Path | Method | Description |
| ---- | ------ | ----------- |
| `/health` | GET | Health check |
| `/.well-known/oauth-authorization-server` | GET | OAuth metadata discovery |
| `/register` | POST | Dynamic client registration (RFC 7591) |
| `/authorize` | GET | Authorization endpoint (redirects to Entra ID) |
| `/callback` | GET | OAuth callback (Entra ID redirects here) |
| `/token` | POST | Token exchange (auth code → access token) |
| `*` | POST | MCP transport (requires Bearer token) |
