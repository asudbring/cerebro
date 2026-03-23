# Read-Only MCP Server Setup (OAuth)

Deploy a second MCP server that provides **read-only access** to your Cerebro brain, protected by **OAuth authentication** via Microsoft Entra ID. Share search access without exposing write capabilities or static API keys.

## What You Get

- **Read-only access** — search, list, and stats only (no capture, complete, or delete)
- **OAuth authentication** — users authenticate via your Entra ID tenant (browser login)
- **No API keys** — pure OAuth 2.1 flow, no static secrets for clients
- **User restrictions** — optionally limit access to specific Entra ID users

## Architecture

```text
MCP Client (VS Code, Claude, etc.)
    │
    │ 1. Connect to mcp.yourdomain.com → 401 + WWW-Authenticate
    │ 2. Discover /.well-known/oauth-protected-resource
    │ 3. Follow to Entra ID authorization server
    │ 4. Authorization Code + PKCE → Entra ID login
    │ 5. Token issued by Entra ID
    │ 6. MCP requests with Bearer token
    │
    ▼
Cloudflare Worker (mcp.yourdomain.com)
    │
    │ Serves OAuth discovery docs at domain root
    │ Proxies MCP requests to Supabase
    │
    ▼
cerebro-mcp-readonly (Supabase Edge Function)
    │
    │ Validates Entra ID JWT via JWKS
    │ 3 read-only tools only
    │
    ▼
Supabase PostgreSQL + pgvector
    │
    ▼
OpenRouter (embeddings for search only)
```

> **Why the Cloudflare Worker?** The MCP OAuth spec requires clients to discover authorization server metadata at the **domain root** (`/.well-known/oauth-protected-resource`). Supabase Edge Functions live at sub-paths (`/functions/v1/name`), so a lightweight proxy at the domain root serves the discovery documents and forwards MCP requests to Supabase.

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
   - **Redirect URI:** Select **Single-page application** and add `http://localhost`
4. Click **Register**
5. Copy into your credential tracker: **Application (client) ID**, **Directory (tenant) ID**, **Object ID**

### Add Redirect URIs

1. Go to **Authentication** → **Single-page application** section
2. Add these redirect URIs:
   - `http://localhost`
   - `http://localhost/callback`
   - `http://127.0.0.1/callback`
   - `https://vscode.dev/redirect`
3. Click **Save**

### Enable Public Client Flows

1. In **Authentication**, scroll to **Advanced settings**
2. Set **Allow public client flows** to **Yes**
3. Click **Save**

> **Why public client?** MCP clients like VS Code use the Authorization Code + PKCE flow without a client secret. This setting allows that.

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

```bash
claude mcp add --transport http cerebro-readonly https://mcp.yourdomain.com/
```

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
- [ ] **Auth Server Metadata** — `/.well-known/oauth-authorization-server` returns Entra ID endpoints
- [ ] **401 without token** — POST without auth returns 401 with `WWW-Authenticate: Bearer resource_metadata="..."`
- [ ] **VS Code OAuth flow** — starting the server triggers Entra ID login prompt
- [ ] **Search works** — after auth, searching returns results from your brain
- [ ] **Read-only** — only 3 tools available (search, list, stats)
- [ ] **(Optional) User restriction** — if `MCP_READONLY_ALLOWED_USERS` is set, unauthorized users get 403

---

## Troubleshooting

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
