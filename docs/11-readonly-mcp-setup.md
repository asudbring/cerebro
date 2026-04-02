# Read-Only MCP Server Setup (OAuth)

Deploy a second MCP server that provides **read-only access** to your Cerebro brain, protected by **OAuth authentication** via Microsoft Entra ID. Share search access without exposing write capabilities or static API keys.

## What You Get

- **Read-only access** — search, list, and stats only (no capture, complete, or delete)
- **OAuth authentication** — users authenticate via your Entra ID tenant (browser login)
- **Dynamic Client Registration** — Claude Code, Open Code, and other DCR-capable clients register automatically (no manual client ID entry)
- **No API keys** — pure OAuth 2.1 flow, no static secrets for clients
- **User restrictions** — optionally limit access to specific Entra ID users

## Architecture

```text
MCP Client (VS Code, Claude Code, Open Code, etc.)
    │
    │ 1. Connect to mcp.yourdomain.com/rw/ → 401 + WWW-Authenticate
    │ 2. Discover /.well-known/oauth-protected-resource/rw/  (path-specific)
    │    → resource: "https://mcp.yourdomain.com/rw/"  (exact match per RFC 9728)
    │ 3. Follow authorization_servers to /.well-known/oauth-authorization-server
    │ 4. (Claude Code / Open Code) POST /register → get client_id
    │ 5. GET /oauth/authorize → strips resource param → 302 to Entra
    │ 6. User logs in at Entra ID
    │ 7. POST /oauth/token → strips resource param → proxies to Entra
    │ 8. Token issued by Entra ID
    │ 9. MCP requests with Bearer token
    │
    ▼
Cloudflare Worker (mcp.yourdomain.com)
    │
    │ /.well-known/oauth-protected-resource[/path]
    │                        → path-specific resource metadata (RFC 9728)
    │ /.well-known/oauth-authorization-server
    │                        → OAuth server metadata with registration_endpoint
    │ POST /register         → DCR stub (RFC 7591) — returns Entra client_id
    │ GET /oauth/authorize   → strips resource, redirects to Entra
    │ POST /oauth/token      → strips resource, proxies to Entra token endpoint
    │ /rw/*                  → proxies to cerebro-mcp (primary, 7 tools)
    │ /*                     → proxies to cerebro-mcp-readonly (3 tools)
    │
    ▼
cerebro-mcp / cerebro-mcp-readonly (Supabase Edge Functions)
    │
    │ Validates Entra ID JWT via JWKS
    │
    ▼
Supabase PostgreSQL + pgvector
    │
    ▼
OpenRouter (embeddings for search only)
```

> **Why the Cloudflare Worker?** The MCP OAuth spec requires clients to discover authorization server metadata at the **domain root** (`/.well-known/oauth-protected-resource`). Supabase Edge Functions live at sub-paths (`/functions/v1/name`), so a lightweight proxy at the domain root serves the discovery documents, handles Dynamic Client Registration, proxies the OAuth flow, and forwards MCP requests to Supabase.

> **How DCR works here:** Entra ID doesn't natively support RFC 7591 Dynamic Client Registration. The Worker provides a stub `/register` endpoint that returns the pre-configured Entra `client_id` for every registration request. All clients share the same Entra public client app — which is safe because the PKCE flow never requires a client secret.

> **Why proxy the OAuth endpoints?** The MCP SDK sends a `resource` parameter (RFC 8707) matching the server's origin URL. Entra rejects this with `AADSTS9010010`. Additionally, DCR clients share the same `client_id` as the resource app (self-token scenario) — Entra requires the GUID format for self-tokens (`AADSTS90009`). The Worker's `/oauth/authorize` and `/oauth/token` endpoints strip `resource` and rewrite `scope` from `api://CLIENT_ID/...` to `CLIENT_ID/...` (bare GUID format) before forwarding to Entra, resolving both conflicts transparently.

> **Path-specific resource metadata (RFC 9728):** VS Code's MCP SDK enforces an exact match between the `resource` field and the URL being connected to. A client connecting to `/rw/` fetches `/.well-known/oauth-protected-resource/rw/` and expects `resource: "https://mcp.yourdomain.com/rw/"`. The Worker derives the resource URL from the path suffix, so each sub-path gets the correct metadata automatically.

## What You Need

- Working Cerebro setup ([Getting Started](01-getting-started.md) completed)
- Microsoft Entra ID tenant
- Azure CLI installed and logged in (`az login`)
- Cloudflare account with a domain (for the OAuth discovery proxy)
- Node.js and npm (for Wrangler CLI)

## Credential Tracker

```text
READ-ONLY MCP -- CREDENTIAL TRACKER
--------------------------------------

ENTRA ID APP REGISTRATION
  Application (client) ID:  ____________ <- Step 1
  Tenant ID:                ____________ <- Step 1
  Object ID:                ____________ <- Step 1
  App ID URI:               ____________ <- Step 2
  Thoughts.Read scope ID:   ____________ <- Step 2

CLOUDFLARE
  Domain/subdomain:         ____________ <- Step 4 (e.g., mcp.yourdomain.com)

--------------------------------------
```

---

## Step 1: Create an Entra ID App Registration

1. Go to the [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations**
2. Click **New registration**
3. Configure:
   - **Name:** `Cerebro Read-Only MCP`
   - **Supported account types:** **Accounts in this organizational directory only (Single tenant)**
   - **Redirect URI:** Leave blank (configured below)
4. Click **Register**
5. Copy into your credential tracker: **Application (client) ID**, **Directory (tenant) ID**, **Object ID**

### Add Redirect URIs

**SPA section** — for VS Code Web only:

1. Go to **Authentication** → **Single-page application** section
2. Add:
   - `https://vscode.dev/redirect`
3. Click **Save**

> **Important:** Keep the SPA section minimal. CLI tools (Claude Code, Open Code, VS Code desktop) must use the public client section below. Registering localhost URIs in the SPA section causes `AADSTS9002327` because SPA tokens can only be redeemed via browser CORS — CLI apps POST directly to the token endpoint.

### Add Native/Public Client Redirect URIs

All localhost and loopback URIs must go in the **mobile and desktop applications** (public client) section so CLI tools can redeem tokens directly.

Use Azure CLI:

```bash
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/YOUR_OBJECT_ID" \
  --body '{
    "publicClient": {
      "redirectUris": [
        "http://localhost",
        "http://localhost/callback",
        "http://127.0.0.1",
        "http://127.0.0.1/callback",
        "http://127.0.0.1:19876/mcp/oauth/callback",
        "https://claude.com/api/mcp/auth_callback",
        "https://claude.ai/api/mcp/auth_callback"
      ]
    }
  }'
```

| URI | Used by |
|-----|---------|
| `http://localhost` | Claude Code (any port, loopback wildcard) |
| `http://localhost/callback` | Generic CLI clients |
| `http://127.0.0.1` | VS Code desktop (any random port) |
| `http://127.0.0.1/callback` | Generic CLI clients |
| `http://127.0.0.1:19876/mcp/oauth/callback` | Open Code (fixed port) |
| `https://claude.com/api/mcp/auth_callback` | Claude.ai web |
| `https://claude.ai/api/mcp/auth_callback` | Claude.ai web (alt domain) |

### Enable Public Client Flows

1. In **Authentication**, scroll to **Advanced settings**
2. Set **Allow public client flows** to **Yes**
3. Click **Save**

> **Why public client?** MCP clients like VS Code use the Authorization Code + PKCE flow without a client secret. This setting also enables `offline_access` — the OIDC scope that causes Entra to issue a refresh token so clients can stay authenticated without re-prompting every hour.

---

## Step 2: Expose the API and Preauthorize VS Code

### Set the Application ID URI

1. Go to **Expose an API**
2. Click **Set** next to Application ID URI
3. Accept the default (`api://YOUR_CLIENT_ID`) or customize
4. Click **Save**

### Add the Thoughts.Read Scope

1. Click **Add a scope**
2. Configure:
   - **Scope name:** `Thoughts.Read`
   - **Who can consent:** Admins and users
   - **Admin consent display name:** Read Cerebro thoughts
   - **Admin consent description:** Allows read-only access to search, list, and view thought statistics
3. Click **Add scope**
4. Copy the **Scope ID** into your credential tracker

### Add the Thoughts.ReadWrite Scope (for primary server OAuth)

1. Click **Add a scope** again
2. Configure:
   - **Scope name:** `Thoughts.ReadWrite`
   - **Who can consent:** Admins and users
   - **Admin consent display name:** Read and Write Cerebro thoughts
   - **Admin consent description:** Allows full access to read, create, update, and delete thoughts
3. Click **Add scope**

### Set Access Token Version to v2

This is required for JWT-format tokens. Use Azure CLI:

```bash
# Replace OBJECT_ID with your app's Object ID
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/OBJECT_ID" \
  --body '{"api":{"requestedAccessTokenVersion":2}}'
```

### Preauthorize VS Code

**This is critical.** VS Code uses its own client ID to request tokens. You must preauthorize it:

1. In **Expose an API**, click **Add a client application**
2. Enter VS Code's client ID: `aebc6443-996d-45c2-90f0-388ff96faa56`
3. Check the boxes next to your `Thoughts.Read` and `Thoughts.ReadWrite` scopes
4. Click **Add application**

> **Without this step**, VS Code will fail with `AADSTS65002: Consent between first party application and first party resource must be configured via preauthorization`.

---

## Step 3: Deploy the Edge Function

### Set Your Secrets

```bash
npx supabase secrets set MCP_READONLY_TENANT_ID=your-entra-tenant-id
npx supabase secrets set MCP_READONLY_CLIENT_ID=your-app-client-id
```

> `OPENROUTER_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` should already be set from the initial setup.

### Optional: Restrict to Specific Users

```bash
npx supabase secrets set MCP_READONLY_ALLOWED_USERS=user-object-id-1,user-object-id-2
```

Look up a user's Object ID:

```bash
az ad user show --id user@example.com --query id -o tsv
```

### Deploy

```bash
# Copy source to deploy directory
cp integrations/mcp-server-readonly/index.ts supabase/functions/cerebro-mcp-readonly/index.ts
cp integrations/mcp-server-readonly/deno.json supabase/functions/cerebro-mcp-readonly/deno.json

# Deploy
npx supabase functions deploy cerebro-mcp-readonly --no-verify-jwt
```

---

## Step 4: Deploy the Cloudflare Worker

The Worker serves OAuth discovery documents at your domain root and proxies MCP requests to Supabase.

### Create DNS Record

1. In your Cloudflare dashboard, go to your domain's DNS settings
2. Add a record:
   - **Type:** AAAA
   - **Name:** `mcp` (or your chosen subdomain)
   - **Content:** `100::`
   - **Proxy status:** Proxied (orange cloud)

### Deploy the Worker

```bash
cd integrations/cloudflare-worker

# Login to Cloudflare (if not already)
npx wrangler login

# Edit wrangler.toml — update the zone name and route to match your domain
# Then deploy
npx wrangler deploy
```

The Worker is configured in `integrations/cloudflare-worker/wrangler.toml`. Update the `zone_name` and route pattern to match your domain.

### Verify the Worker

```bash
# Health (proxied to Supabase)
curl https://mcp.yourdomain.com/health

# OAuth discovery
curl https://mcp.yourdomain.com/.well-known/oauth-protected-resource
curl https://mcp.yourdomain.com/.well-known/oauth-authorization-server

# Unauthenticated MCP request (should return 401)
curl -X POST https://mcp.yourdomain.com/ -H "Content-Type: application/json"
```

---

## Step 5: Connect Your AI Client

### VS Code (Recommended)

Add to your `mcp.json` (User or Workspace level):

```json
{
  "servers": {
    "cerebro-readonly": {
      "type": "http",
      "url": "https://mcp.yourdomain.com/"
    }
  }
}
```

When you start the server, VS Code will:

1. Discover OAuth metadata at the domain root
2. Redirect you to Entra ID login
3. Exchange the token automatically
4. Connect to the read-only MCP tools

### Claude Code

Claude Code supports Dynamic Client Registration — it will call `POST /register` automatically and receive the Entra client_id without any manual configuration needed.

```bash
claude mcp add --transport http cerebro-readonly https://mcp.yourdomain.com/
```

Claude Code will register itself, open a browser for Entra ID login, and connect automatically.

### Open Code

Open Code also supports Dynamic Client Registration. Add the server via its MCP configuration:

```json
{
  "mcpServers": {
    "cerebro-readonly": {
      "type": "http",
      "url": "https://mcp.yourdomain.com/"
    }
  }
}
```

Open Code will register itself and prompt for Entra ID login automatically.

### Other Clients (Manual Token)

For clients that don't support OAuth discovery:

```bash
az account get-access-token \
  --resource api://YOUR_CLIENT_ID \
  --tenant YOUR_TENANT_ID \
  --query accessToken -o tsv
```

Then pass as `Authorization: Bearer <token>` header. Tokens expire after ~1 hour.

---

## ✅ Verification Checklist

- [ ] **Health endpoint** — `https://mcp.yourdomain.com/health` returns `{"status":"ok","service":"cerebro-mcp-readonly","auth":"entra-id"}`
- [ ] **Protected Resource Metadata** — `/.well-known/oauth-protected-resource` returns JSON pointing to Entra ID
- [ ] **Auth Server Metadata** — `/.well-known/oauth-authorization-server` returns Entra ID endpoints with `registration_endpoint`
- [ ] **DCR endpoint** — `POST /register` returns 201 with `client_id` equal to your Entra client ID
- [ ] **401 without token** — POST without auth returns 401 with `WWW-Authenticate: Bearer resource_metadata="..."`
- [ ] **VS Code OAuth flow** — starting the server triggers Entra ID login prompt
- [ ] **Claude Code OAuth flow** — `claude mcp add` registers and authenticates automatically
- [ ] **Search works** — after auth, searching returns results from your brain
- [ ] **Read-only** — only 3 tools available (search, list, stats)
- [ ] **(Optional) User restriction** — if `MCP_READONLY_ALLOWED_USERS` is set, unauthorized users get 403

```bash
# Test DCR endpoint
curl -s -X POST https://mcp.yourdomain.com/register \
  -H "Content-Type: application/json" \
  -d '{"redirect_uris":["http://localhost/callback"],"grant_types":["authorization_code"]}' \
  | jq .

# Expected: { "client_id": "YOUR_ENTRA_CLIENT_ID", "client_id_issued_at": ..., ... }
```

---

## Troubleshooting

### Resource metadata 'resource' does not match expected value

VS Code's MCP SDK enforces RFC 9728 strict validation: the `resource` field must exactly match the URL being connected to. A client connecting to `https://mcp.yourdomain.com/rw/` fetches `/.well-known/oauth-protected-resource/rw/` and expects `resource: "https://mcp.yourdomain.com/rw/"`. The Worker handles this automatically by deriving the resource URL from the path suffix — ensure you're running the latest deployed Worker code.

### AADSTS9002327: SPA tokens cannot be redeemed by CLI clients

CLI tools (Claude Code, Open Code, VS Code desktop) POST directly to the token endpoint to redeem auth codes. Entra rejects this for redirect URIs registered in the **SPA** section — SPA tokens can only be redeemed via browser CORS requests.

Fix: move all `localhost` and `127.0.0.1` redirect URIs from the SPA section to the **public client** (`publicClient.redirectUris`) section. Only `https://vscode.dev/redirect` belongs in SPA.

```bash
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/YOUR_OBJECT_ID" \
  --body '{
    "spa": {"redirectUris": ["https://vscode.dev/redirect"]},
    "publicClient": {"redirectUris": ["http://localhost","http://localhost/callback","http://127.0.0.1","http://127.0.0.1/callback","http://127.0.0.1:19876/mcp/oauth/callback"]}
  }'
```

### AADSTS50011: Redirect URI mismatch (VS Code random port)

VS Code desktop picks a random port for its OAuth callback (e.g., `http://127.0.0.1:33418/`). This fails unless `http://127.0.0.1` is registered in the **public client** redirect URIs (not the SPA section). With `allowPublicClient: true` and `http://127.0.0.1` in `publicClient.redirectUris`, Entra applies RFC 8252 loopback rules and accepts any port dynamically.

```bash
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/YOUR_OBJECT_ID" \
  --body '{"publicClient":{"redirectUris":["http://127.0.0.1","http://127.0.0.1:19876/mcp/oauth/callback"]}}'
```

### Re-authenticating on every tool open

If you're prompted to log in every time you open a client, the access token expired and no refresh token was issued. This happens when `offline_access` is missing from the OAuth server's `scopes_supported`. The Worker now advertises `offline_access` — **re-authenticate once** to pick up a refresh token and clients will stay authenticated silently going forward (Entra refresh tokens last 90 days of inactivity).

### AADSTS9010010: Resource parameter mismatch

The MCP SDK sends `resource=https://mcp.yourdomain.com` (RFC 8707) to the authorization and token endpoints. Entra ID rejects this when it doesn't match the scope audience (`api://client-id`). The Worker's `/oauth/authorize` and `/oauth/token` proxy endpoints strip the `resource` parameter before forwarding to Entra. If you see this error, ensure your `wrangler.toml` has the correct `ENTRA_TENANT_ID` and the Worker is deployed with the latest code.

### AADSTS90009: Self-token requires GUID-based identifier

DCR clients (Claude Code, Open Code) share the same `client_id` as the resource app — Entra calls this a "self-token" scenario. On the v2.0 endpoint, Entra infers the resource from `scope`. If the scope uses the `api://` URI format (e.g., `api://CLIENT_ID/Thoughts.ReadWrite`), Entra rejects it. The Worker rewrites scope to strip the `api://` prefix (→ `CLIENT_ID/Thoughts.ReadWrite`), using the GUID format Entra requires for self-tokens.

### AADSTS65002: Consent error

VS Code's client ID must be preauthorized in your app registration. Go to **Expose an API** → **Authorized client applications** and add `aebc6443-996d-45c2-90f0-388ff96faa56` with the `Thoughts.Read` scope.

### platform_broker_error

The Windows Auth Broker (WAM) fails when using `/common/v2.0` as the auth server endpoint. Ensure your OAuth metadata uses the tenant-specific endpoint: `https://login.microsoftonline.com/YOUR_TENANT_ID/v2.0`.

### OAuth discovery not found

VS Code looks for discovery docs at the **domain root**, not at sub-paths. Ensure your Cloudflare Worker is deployed and the DNS record is pointing to it. Test: `curl https://mcp.yourdomain.com/.well-known/oauth-protected-resource`

### Token validation errors

- Verify `MCP_READONLY_TENANT_ID` and `MCP_READONLY_CLIENT_ID` match your Entra ID app
- Ensure `requestedAccessTokenVersion` is set to `2` (for JWT format tokens)
- Check that the audience in the token matches your app's client ID or `api://` URI

### "User not authorized" (403)

If `MCP_READONLY_ALLOWED_USERS` is set, verify the user's Object ID is in the list:

```bash
az ad user show --id user@example.com --query id -o tsv
```

### DNS not resolving

If `mcp.yourdomain.com` doesn't resolve, check:

- Cloudflare DNS record exists (AAAA → `100::`, proxied)
- Your local DNS forwarders can reach public resolvers (1.1.1.1, 8.8.8.8)
- Flush local DNS cache: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)

### Search returns no results

- Verify `OPENROUTER_API_KEY` is set and has credits
- Try a broader search with a lower threshold

---

## Environment Variables Reference

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `SUPABASE_URL` | Auto | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Service role key |
| `OPENROUTER_API_KEY` | Yes | For generating search embeddings |
| `MCP_READONLY_TENANT_ID` | Yes | Entra ID tenant ID |
| `MCP_READONLY_CLIENT_ID` | Yes | Entra ID app client ID |
| `MCP_READONLY_ALLOWED_USERS` | No | Comma-separated Entra ID Object IDs to restrict access |

## Comparison: Primary vs Read-Only MCP Server

| Feature | `cerebro-mcp` | `cerebro-mcp-readonly` |
| ------- | ------------- | ---------------------- |
| Tools | 7 (read + write) | 3 (read only) |
| Auth | OAuth 2.1 (Entra ID) + API key fallback | OAuth 2.1 (Entra ID) only |
| Proxy | Cloudflare Worker at `/rw/` path | Cloudflare Worker at domain root |
| Capture | ✅ | ❌ |
| Complete/Reopen/Delete | ✅ | ❌ |
| Search | ✅ | ✅ |
| List | ✅ | ✅ |
| Stats | ✅ | ✅ |
| Calendar reminders | ✅ | ❌ |
| OAuth URL | `https://mcp.yourdomain.com/rw/` | `https://mcp.yourdomain.com/` |
| API key URL | Direct Supabase URL with `x-brain-key` | N/A |

> **Note:** The primary server now supports OAuth via the same Cloudflare Worker. Connect to `mcp.yourdomain.com/rw/` for OAuth-authenticated access to all 7 tools. API-key clients can still use the direct Supabase URL or the Worker URL with `x-brain-key` header.
