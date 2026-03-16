# iMessage Capture Setup

Capture and search thoughts from iMessage — works on iPhone, iPad, Mac, and Apple Watch via BlueBubbles on a Mac server.

## What You Need

- Working Cerebro setup ([Getting Started](01-getting-started.md) completed)
- A Mac (always-on, acts as server) running macOS 12+
- An iCloud/Apple ID signed into Messages on that Mac
- [BlueBubbles Server](https://bluebubbles.app) installed on the Mac
- Cloudflare account (free tier) for a named tunnel
- A domain you control (for permanent tunnel URL)

## Architecture

```text
Phone → iMessage → Mac (Messages.app) → BlueBubbles Server → Webhook
  → Supabase Edge Function (cerebro-imessage) → Supabase DB

Replies:
  Edge Function → BlueBubbles REST API → Messages.app → iMessage → Phone
```

## Credential Tracker

```text
iMESSAGE CAPTURE -- CREDENTIAL TRACKER
---------------------------------------

BLUEBUBBLES
  Server Password:    ____________ <- Step 1

CLOUDFLARE TUNNEL
  Tunnel ID:          ____________ <- Step 2
  Tunnel Hostname:    ____________ <- Step 2

SUPABASE
  Project Ref:        ____________ <- already set
  Edge Function URL:  ____________ <- Step 3

---------------------------------------
```

---

## Step 1: Install BlueBubbles

1. Download from [https://bluebubbles.app](https://bluebubbles.app)
2. Install in `/Applications`
3. Open and complete initial setup (sign in, let it index messages)
4. Set a server password — paste into your credential tracker
5. Disable BlueBubbles' built-in proxy: go to **Settings → Proxy Service** and set it to **None** — we'll use a Cloudflare named tunnel instead

> BlueBubbles runs a local REST API on port `1234` by default. You can verify it's working with `curl http://localhost:1234/api/v1/ping`.

---

## Step 2: Set Up Cloudflare Named Tunnel

### Add Your Domain to Cloudflare

1. Sign in at [https://dash.cloudflare.com](https://dash.cloudflare.com) (free plan)
2. Add your domain and update nameservers at your registrar

### Install cloudflared on the Mac

Download from [https://github.com/cloudflare/cloudflared/releases](https://github.com/cloudflare/cloudflared/releases) or install via Homebrew:

```bash
brew install cloudflared
```

### Create the Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create cerebro-bb
cloudflared tunnel route dns cerebro-bb bb.yourdomain.com
```

Copy the **Tunnel ID** into your credential tracker.

### Configure the Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: /Users/<user>/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: bb.yourdomain.com
    service: http://localhost:1234
  - service: http_status:404
```

### Install as a launchd Service (Auto-Start)

Create `/Library/LaunchDaemons/com.cloudflare.cerebro-bb.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.cloudflare.cerebro-bb</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/cloudflared</string>
    <string>tunnel</string>
    <string>run</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>/Users/YOUR_USERNAME</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/cloudflare-cerebro-bb.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/cloudflare-cerebro-bb.err</string>
</dict>
</plist>
```

Load the service:

```bash
sudo launchctl load /Library/LaunchDaemons/com.cloudflare.cerebro-bb.plist
```

### Verify the Tunnel

```bash
curl https://bb.yourdomain.com/api/v1/ping
```

Should return a response from BlueBubbles confirming the tunnel is live.

---

## Step 3: Deploy the Edge Function

From your Cerebro project directory:

```bash
supabase functions new cerebro-imessage
```

Copy the contents of [`integrations/imessage-capture/index.ts`](../integrations/imessage-capture/index.ts) into `supabase/functions/cerebro-imessage/index.ts`.

Deploy:

```bash
supabase functions deploy cerebro-imessage --no-verify-jwt
```

Your function is now live at:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-imessage
```

---

## Step 4: Set Secrets

```bash
supabase secrets set \
  BLUEBUBBLES_URL=https://bb.yourdomain.com \
  BLUEBUBBLES_PASSWORD=your-bb-password \
  BLUEBUBBLES_ALLOWED_CHATS="iMessage;-;+1XXXXXXXXXX,iMessage;-;you@email.com"
```

> `OPENROUTER_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` should already be set.

**Finding your chat GUIDs:** Use the BlueBubbles API to list your chats:

```bash
curl "https://bb.yourdomain.com/api/v1/chat?guid=YOUR_BB_PASSWORD&limit=20"
```

`BLUEBUBBLES_ALLOWED_CHATS` is a comma-separated list of chat GUIDs the bot will respond to. For self-chat, you may have both phone number and email address variants — include all of them.

---

## Step 5: Apply Database Migration

In the Supabase SQL Editor, run the contents of `schemas/core/006-imessage-digest.sql` to add iMessage support to digest channels.

---

## Step 6: Register Webhook in BlueBubbles

Tell BlueBubbles to forward incoming messages to your Edge Function:

```bash
curl -X POST "https://bb.yourdomain.com/api/v1/webhook?guid=YOUR_BB_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-imessage",
    "events": ["new-message"]
  }'
```

Verify the webhook was registered:

```bash
curl "https://bb.yourdomain.com/api/v1/webhook?guid=YOUR_BB_PASSWORD"
```

---

## Step 7: Fix macOS Automation Permission (If Needed)

If BlueBubbles can't send replies (error `-1743`: "Not authorized to send Apple events to Messages"), the TCC database needs a manual permission entry.

### Grant Terminal Full Disk Access

Go to **System Settings → Privacy & Security → Full Disk Access** and enable **Terminal.app**.

### Back Up the TCC Database

```bash
cp ~/Library/Application\ Support/com.apple.TCC/TCC.db \
   ~/Library/Application\ Support/com.apple.TCC/TCC.db.bak
```

### Insert the Automation Permission

```bash
sqlite3 ~/Library/Application\ Support/com.apple.TCC/TCC.db \
  "INSERT OR REPLACE INTO access (
    service, client, client_type, auth_value, auth_reason, auth_version,
    csreq, policy_id, indirect_object_identifier_type,
    indirect_object_identifier, indirect_object_code_identity, flags,
    last_modified, pid, pid_version, boot_uuid, last_reminded
  ) VALUES (
    'kTCCServiceAppleEvents',
    'com.BlueBubbles.BlueBubbles-Server',
    0, 2, 4, 1,
    X'fade0c00000000b000000001000000060000000200000022636f6d2e426c7565427562626c65732e426c7565427562626c65732d5365727665720000000000060000000f000000060000000e000000010000000a2a864886f76364060206000000000000000000060000000e000000000000000a2a864886f7636406010d0000000000000000000b000000000000000a7375626a6563742e4f550000000000010000000a575056323735483857370000',
    NULL, 0,
    'com.apple.MobileSMS',
    NULL, 0,
    CAST(strftime('%s','now') AS INTEGER),
    NULL, NULL, 'UNUSED', 0
  );"
```

### Restart BlueBubbles

Quit and reopen BlueBubbles Server. Replies should now work.

---

## Commands

From iMessage, send these to your self-chat:

| Command | Example | Description |
|---------|---------|-------------|
| **Capture** | `Had a great idea for the new project` | Just type any thought — it's captured automatically |
| **Search** | `search career changes` | Semantic search across all your thoughts |
| **Stats** | `stats` | Summary of your thought database |
| **Complete task** | `done call the dentist` | Mark a task as done |
| **Reopen task** | `reopen call the dentist` | Reopen a completed task |
| **Delete** | `delete old reminder` | Soft-delete a thought or task |
| **Help** | `help` | Show available commands |
| **File attachment** | *(send an image, PDF, or document)* | File is analyzed via AI vision and captured |

---

## Digest Delivery

iMessage channels are automatically registered for daily/weekly digests when you apply the migration in Step 5. The `daily-digest` Edge Function delivers digests via BlueBubbles to your iMessage chat.

See **[Daily Digest Setup](06-daily-digest-setup.md)** for scheduling configuration.

---

## ✅ Verification Checklist

Before moving on, confirm all of these pass:

- [ ] **Tunnel is live** — `curl https://bb.yourdomain.com/api/v1/ping` returns a response
- [ ] **Webhook registered** — GET `https://bb.yourdomain.com/api/v1/webhook?guid=PASSWORD` shows your Edge Function URL
- [ ] **Capture works** — send a thought via iMessage and receive a confirmation reply
- [ ] **Search works** — send `search test` and get matching results
- [ ] **Stats works** — send `stats` and get a summary
- [ ] **File attachments** — send an image and receive an AI-generated description
- [ ] **Supabase data** — Table Editor → `thoughts` shows rows with `metadata.source` = `"imessage"`

> If any check fails, see the **Troubleshooting** section below.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No response from bot | Check `BLUEBUBBLES_ALLOWED_CHATS` includes ALL your chat GUIDs (both phone and email variants) |
| Send fails (`-1743`) | Follow Step 7 above for TCC automation permission fix |
| Webhook not firing | Verify webhook exists: GET `https://bb.yourdomain.com/api/v1/webhook?guid=PASSWORD` |
| Tunnel down | Check launchd service: `sudo launchctl list \| grep cloudflare` and review `/tmp/cloudflare-cerebro-bb.log` |
| Edge Function errors | Check Supabase Dashboard → Edge Functions → `cerebro-imessage` → Logs |
| Vision API errors | Verify OpenRouter API key has credits remaining |
| BlueBubbles not indexing | Ensure Messages.app is open and signed into iCloud on the Mac |

## Cost Estimate

| Component | Free Tier | Cost Beyond Free |
|-----------|-----------|-----------------|
| Cloudflare Tunnel | Unlimited | Free |
| Supabase Edge Functions | 500K invocations/month | $2 per million |
| BlueBubbles Server | Free & open-source | Free |
| OpenRouter (embeddings + extraction) | — | ~$0.001/thought |

Typical usage (10-30 messages/day): well within free tier for all components.
