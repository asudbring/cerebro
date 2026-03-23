# Read-Only MCP Server Setup (OAuth)

Deploy a second MCP server that provides **read-only access** to your Cerebro brain, protected by **OAuth authentication** via Microsoft Entra ID. Share search access without exposing write capabilities or static API keys.

## What You Get

- **Read-only access** — search, list, and stats only (no capture, complete, or delete)
- **OAuth authentication** — users authenticate via your Entra ID tenant (browser login)
- **Separate URL** — independent from the primary MCP server
- **User restrictions** — optionally limit access to specific Entra ID users

## What You Need

- Working Cerebro setup ([Getting Started](01-getting-started.md) completed)
- Microsoft Entra ID tenant (you already have this from your Azure setup)
- Azure CLI installed and logged in (`az login`)

## Credential Tracker

```text
READ-ONLY MCP -- CREDENTIAL TRACKER
--------------------------------------

ENTRA ID APP REGISTRATION
  Application (client) ID:  ____________ <- Step 1
  Tenant ID:                ____________ <- Step 1
  Object ID:                ____________ <- Step 1

CEREBRO
  Signing Secret:           ____________ <- Step 2
  Edge Function URL:        ____________ <- Step 3

--------------------------------------
```

---

## Step 1: Create an Entra ID App Registration

This creates the OAuth identity that users authenticate against.

1. Go to the [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations**
2. Click **New registration**
3. Configure:
   - **Name:** `Cerebro Read-Only MCP`
   - **Supported account types:** **Accounts in this organizational directory only (Single tenant)**
   - **Redirect URI:** skip for now
4. Click **Register**

Copy into your credential tracker:

- **Application (client) ID**
- **Directory (tenant) ID**
- **Object ID**

### Configure Redirect URIs

1. In your app registration, go to **Authentication**
2. Click **Add a platform** → **Single-page application**
3. Add these redirect URIs:
   - `http://localhost`
   - `http://localhost/callback`
   - `http://127.0.0.1/callback`
4. Click **Add a platform** → **Web**
5. Add this redirect URI:
   - `https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp-readonly/callback`
6. Under **Implicit grant and hybrid flows**, check:
   - ✅ **Access tokens**
   - ✅ **ID tokens**
7. Click **Save**

> **Why two platform types?** The SPA URIs support MCP clients doing PKCE-based OAuth flows locally. The Web URI supports the server-side callback from Entra ID.

### No Client Secret Needed

This app uses the **Authorization Code + PKCE** flow (public client), so no client secret is required. The server-side code exchange uses the SPA configuration which doesn't require a secret.

---

## Step 2: Generate a Signing Secret

The read-only server issues its own short-lived JWT tokens after validating users with Entra ID. You need a secret to sign these tokens.

**Mac/Linux:**

```bash
openssl rand -hex 32
```

**Windows (PowerShell):**

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

Save the output in your credential tracker.

---

## Step 3: Deploy the Edge Function

### Set Your Secrets

```bash
supabase secrets set MCP_READONLY_TENANT_ID=your-entra-tenant-id
supabase secrets set MCP_READONLY_CLIENT_ID=your-app-client-id
supabase secrets set MCP_READONLY_SIGNING_SECRET=your-signing-secret-from-step-2
```

> `OPENROUTER_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` should already be set from the initial setup.

### Optional: Restrict to Specific Users

To limit access to specific Entra ID users, set their Object IDs:

```bash
supabase secrets set MCP_READONLY_ALLOWED_USERS=user-object-id-1,user-object-id-2
```

Look up a user's Object ID:

```bash
az ad user show --id user@example.com --query id -o tsv
```

When the allowlist is set, unauthorized users receive a 403 after authenticating. When unset, any user in your tenant can access the read-only server.

### Create and Deploy the Function

```bash
supabase functions new cerebro-mcp-readonly
```

Copy the contents of [`integrations/mcp-server-readonly/deno.json`](../integrations/mcp-server-readonly/deno.json) into `supabase/functions/cerebro-mcp-readonly/deno.json`.

Copy the contents of [`integrations/mcp-server-readonly/index.ts`](../integrations/mcp-server-readonly/index.ts) into `supabase/functions/cerebro-mcp-readonly/index.ts`.

Deploy:

```bash
supabase functions deploy cerebro-mcp-readonly --no-verify-jwt
```

Your read-only MCP server is now live at:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp-readonly
```

---

## Step 4: Connect Your AI Client

### Claude Desktop (OAuth Flow)

1. Open Claude Desktop → **Settings** → **Connectors**
2. Click **Add custom connector**
3. Name: `Cerebro (Read-Only)`
4. Remote MCP server URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp-readonly`
5. Click **Add**

When you start a conversation, Claude will prompt you to authenticate via your Entra ID login page. After logging in, the read-only tools become available.

### Claude Code

```bash
claude mcp add --transport http cerebro-readonly \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp-readonly
```

Claude Code will handle the OAuth flow automatically when you first use a Cerebro tool.

### Other Clients (Manual Token)

For clients that don't support OAuth discovery, get a token manually:

```bash
# Get an access token from Entra ID
az account get-access-token \
  --resource YOUR_CLIENT_ID \
  --tenant YOUR_TENANT_ID \
  --query accessToken -o tsv
```

Then configure the MCP connection with the Bearer token:

```json
{
  "mcpServers": {
    "cerebro-readonly": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp-readonly",
        "--header",
        "Authorization:Bearer ${MCP_TOKEN}"
      ],
      "env": {
        "MCP_TOKEN": "paste-your-token-here"
      }
    }
  }
}
```

> **Note:** Entra ID tokens expire after ~1 hour. Re-run the `az` command to get a fresh token.

---

## Step 5: Test It

### Health Check

```bash
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp-readonly/health
```

Expected: `{"status":"ok","service":"cerebro-mcp-readonly","auth":"oauth"}`

### OAuth Metadata

```bash
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp-readonly/.well-known/oauth-authorization-server
```

Expected: JSON with `authorization_endpoint`, `token_endpoint`, etc.

### Unauthenticated Request

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp-readonly
```

Expected: 401 with `WWW-Authenticate: Bearer resource_metadata="..."` header.

### Read-Only Verification

After authenticating, try to use `capture_thought` — it should not be available. Only `search_thoughts`, `list_thoughts`, and `thought_stats` should appear in the tool list.

---

## ✅ Verification Checklist

Before moving on, confirm all of these pass:

- [ ] **Health endpoint** — `/health` returns `{"status":"ok","service":"cerebro-mcp-readonly","auth":"oauth"}`
- [ ] **OAuth metadata** — `/.well-known/oauth-authorization-server` returns valid JSON
- [ ] **401 without token** — POST to the server without auth returns 401 with `WWW-Authenticate` header
- [ ] **Authentication works** — connecting via an MCP client triggers Entra ID login
- [ ] **Search works** — after auth, searching returns results from your brain
- [ ] **Read-only** — only 3 tools available (no capture, complete, reopen, or delete)
- [ ] **(Optional) User restriction** — if `MCP_READONLY_ALLOWED_USERS` is set, unauthorized users get 403

---

## Troubleshooting

### OAuth metadata not found

- Verify the function deployed: visit the health endpoint in a browser
- Check that the function name is exactly `cerebro-mcp-readonly`

### Entra ID login fails

- Verify redirect URIs in the app registration include the callback URL
- Check that the app is configured as Single tenant and matches your tenant ID
- Ensure ID tokens and access tokens are enabled under Authentication

### Token validation errors

- Verify `MCP_READONLY_TENANT_ID` and `MCP_READONLY_CLIENT_ID` match your Entra ID app
- Check that `MCP_READONLY_SIGNING_SECRET` is set

### "User not authorized" (403)

- If `MCP_READONLY_ALLOWED_USERS` is set, verify the user's Object ID is in the list
- Look up the Object ID: `az ad user show --id user@example.com --query id -o tsv`

### Search returns no results

- Verify `OPENROUTER_API_KEY` is set and has credits
- Try a broader search with a lower threshold

### Token expired

- Server-issued tokens expire after 1 hour
- Reconnect via your MCP client to trigger a new OAuth flow
- For manual tokens, re-run the `az` command

---

## Architecture

```text
MCP Client (Claude, ChatGPT, etc.)
    │
    │ 1. Connect → 401 + WWW-Authenticate
    │ 2. Discover OAuth metadata
    │ 3. Authorization Code + PKCE → Entra ID login
    │ 4. Callback → server code
    │ 5. Exchange code → Bearer token
    │ 6. MCP requests with Bearer token
    │
    ▼
cerebro-mcp-readonly (Supabase Edge Function)
    │
    │ Validates JWT (server-issued or Entra ID direct)
    │ 3 read-only tools only
    │
    ▼
Supabase PostgreSQL + pgvector
    │
    ▼
OpenRouter (embeddings for search only)
```

## Environment Variables Reference

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `SUPABASE_URL` | Auto | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Service role key |
| `OPENROUTER_API_KEY` | Yes | For generating search embeddings |
| `MCP_READONLY_TENANT_ID` | Yes | Entra ID tenant ID |
| `MCP_READONLY_CLIENT_ID` | Yes | Entra ID app client ID |
| `MCP_READONLY_SIGNING_SECRET` | Yes | Secret for signing server JWT tokens |
| `MCP_READONLY_ALLOWED_USERS` | No | Comma-separated Entra ID Object IDs to restrict access |

## Comparison: Primary vs Read-Only MCP Server

| Feature | `cerebro-mcp` | `cerebro-mcp-readonly` |
| ------- | ------------- | ---------------------- |
| Tools | 7 (read + write) | 3 (read only) |
| Auth | Static API key (`x-brain-key`) | OAuth 2.1 (Entra ID) |
| Capture | ✅ | ❌ |
| Complete/Reopen/Delete | ✅ | ❌ |
| Search | ✅ | ✅ |
| List | ✅ | ✅ |
| Stats | ✅ | ✅ |
| Calendar reminders | ✅ | ❌ |
| URL | `.../cerebro-mcp?key=...` | `.../cerebro-mcp-readonly` |
