# Discord Capture Setup

Capture and search thoughts from Discord using slash commands — works on desktop, mobile, and web.

## What You Need

- Working Cerebro setup ([Getting Started](01-getting-started.md) completed)
- Discord account (free)

## Credential Tracker

```text
DISCORD CAPTURE -- CREDENTIAL TRACKER
--------------------------------------

DISCORD APPLICATION
  Application ID:    ____________ <- Step 1
  Public Key:        ____________ <- Step 1
  Bot Token:         ____________ <- Step 1

--------------------------------------
```

---

## Step 1: Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Name: `Cerebro`
4. Click **Create**

### Copy Your Keys

On the **General Information** page, copy into your credential tracker:

- **Application ID**
- **Public Key**

### Create a Bot User

1. In the left sidebar, click **Bot**
2. Click **Reset Token** (or **Add Bot** if prompted)
3. Copy the **Token** — paste into your credential tracker as Bot Token
4. Under **Privileged Gateway Intents**, leave all toggles OFF (not needed for slash commands)

---

## Step 2: Deploy the Edge Function

### Set Your Secrets

From your Cerebro project directory:

```bash
supabase secrets set DISCORD_PUBLIC_KEY=your-public-key-from-step-1
supabase secrets set DISCORD_BOT_TOKEN=your-bot-token-from-step-1
```

> `OPENROUTER_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` should already be set.

### Create and Deploy

```bash
supabase functions new cerebro-discord
```

Copy the contents of [`integrations/discord-capture/deno.json`](../integrations/discord-capture/deno.json) into `supabase/functions/cerebro-discord/deno.json`.

Copy the contents of [`integrations/discord-capture/index.ts`](../integrations/discord-capture/index.ts) into `supabase/functions/cerebro-discord/index.ts`.

Deploy:

```bash
supabase functions deploy cerebro-discord --no-verify-jwt
```

Your function is now live at:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-discord
```

---

## Step 3: Set the Interactions Endpoint

1. Go back to the [Discord Developer Portal](https://discord.com/developers/applications) → your app
2. On **General Information**, find **Interactions Endpoint URL**
3. Paste your Edge Function URL:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-discord
   ```

4. Click **Save Changes**

Discord will send a verification PING to your endpoint. If it saves successfully, your endpoint is working.

> If verification fails, double-check that the function deployed and the `DISCORD_PUBLIC_KEY` secret is correct.

---

## Step 4: Register Slash Commands

Run these commands in your terminal to register the `/capture` and `/search` commands with Discord. Replace `YOUR_APPLICATION_ID` and `YOUR_BOT_TOKEN` with values from your credential tracker.

### Register `/capture`

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -d '{
    "name": "capture",
    "description": "Capture a thought to your Cerebro brain",
    "options": [
      {
        "name": "thought",
        "description": "The thought to capture",
        "type": 3,
        "required": true
      }
    ]
  }' \
  "https://discord.com/api/v10/applications/YOUR_APPLICATION_ID/commands"
```

### Register `/search`

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -d '{
    "name": "search",
    "description": "Search your Cerebro thoughts by meaning",
    "options": [
      {
        "name": "query",
        "description": "What to search for",
        "type": 3,
        "required": true
      }
    ]
  }' \
  "https://discord.com/api/v10/applications/YOUR_APPLICATION_ID/commands"
```

> Slash commands may take up to an hour to appear globally. For instant testing, register guild-specific commands by replacing `/commands` with `/guilds/YOUR_GUILD_ID/commands` in the URLs above.

---

## Step 5: Invite the Bot to Your Server

Build an invite URL using your Application ID:

```text
https://discord.com/api/oauth2/authorize?client_id=YOUR_APPLICATION_ID&scope=applications.commands%20bot
```

1. Open this URL in your browser
2. Select the server to add Cerebro to
3. Click **Authorize**

---

## Step 6: Test It

### Capture a Thought

In any channel in your server (or a DM with the bot), type:

```text
/capture thought:Sarah mentioned she's thinking about leaving her job to start a consulting business
```

You should see a "thinking..." indicator followed by a confirmation with extracted metadata.

### Search Your Thoughts

```text
/search query:career changes
```

You should get back matching thoughts ranked by semantic similarity.

### Verify in Supabase

Open Supabase Dashboard → Table Editor → `thoughts`. New rows should have `metadata.source = "discord"`.

---

## Troubleshooting

### Slash commands don't appear

- Global commands take up to 1 hour to propagate. Use guild-specific registration for instant testing.
- Make sure the bot is invited to your server with the `applications.commands` scope.

### Interactions endpoint verification fails

- Check that `DISCORD_PUBLIC_KEY` is set correctly (it's the hex string from General Information, not the bot token).
- Verify the Edge Function is deployed: visit the URL in a browser — should return `{"status":"ok","service":"cerebro-discord"}`.

### Bot responds with error

- Check Supabase Edge Function logs for detailed error messages.
- Verify `OPENROUTER_API_KEY` is set and has credits.

### "Application did not respond" error

- The Edge Function must respond within 3 seconds. The deferred response pattern (type 5) handles this — if you see this error, the function may not be receiving requests at all. Check the interactions endpoint URL.

---

## ✅ Verification Checklist

Before moving on, confirm all of these pass:

- [ ] **Capture works** — `/capture thought:test thought` returns a confirmation with extracted metadata (topics, type)
- [ ] **Search works** — `/search query:test` returns matching results ranked by similarity
- [ ] **Supabase data** — Table Editor → `thoughts` shows rows with `metadata.source` = `"discord"`
- [ ] **Edge Function health** — visiting `https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-discord` in a browser returns `{"status":"ok","service":"cerebro-discord"}`

> If any check fails, see the **Troubleshooting** section above.

---

## Calendar Reminders

When you capture a thought that mentions a future date or time (e.g. `/capture thought:call the dentist tomorrow at 2pm`), Cerebro can automatically create calendar events on O365 and/or Google Calendar.

See **[Reminders Setup](05-reminders-setup.md)** for configuration instructions.
