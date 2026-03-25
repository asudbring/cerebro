# Deploy Cerebro with an AI Coding Tool

## The Short Version

Open this repo in your AI coding tool and tell it:

> **"Read `docs/SETUP.md` and `docs/01-getting-started.md` and walk me through deploying Cerebro step by step."**

That's it. Every SQL block, every Edge Function, every CLI command, every configuration step lives in this repo. Your AI reads the docs and helps you execute each one. You handle the clicking (Supabase dashboard, Discord developer portal, etc.). Your AI handles the code.

This works in **Claude Code, Cursor, GitHub Copilot, Windsurf, Codex**, or any AI coding tool that can read local files and run terminal commands.

---

## How to Start

1. Clone this repo (or open it if you already have it)
2. Open it in your AI coding tool
3. Say: **"Read `docs/SETUP.md` and walk me through Phase 1."**
4. Complete Phase 1, verify it works, then move to Phase 2
5. Repeat through each phase you want

The sections below explain what to expect at each phase and what to watch out for.

---

## What Your AI Handles Well

- **SQL setup** — Creating tables, functions, indexes, and security policies. Your AI can paste these directly into the Supabase SQL Editor or walk you through each block.
- **Edge Function code** — All capture integrations (`mcp-server`, `teams-capture`, `discord-capture`, `alexa-capture`, `daily-digest`) are fully written in `integrations/`. Your AI reads them and helps you deploy.
- **CLI commands** — Installing Supabase CLI, linking projects, deploying functions, setting secrets. Your AI can run these directly if your tool supports terminal access.
- **Debugging** — When something doesn't work, your AI can read Edge Function logs and help diagnose. This is where AI-assisted setup genuinely shines over going solo.
- **Credential management** — Your AI can remind you to save each credential as you create it and reference them later when setting secrets.

## What You Should Do Manually

Some steps involve clicking through web UIs where your AI can't help directly. These are fast but you need to do them yourself:

- **Creating accounts** — Supabase, OpenRouter, Discord, Amazon Developer. Sign up in your browser.
- **Supabase dashboard settings** — Enabling the vector extension, copying your Project URL and Service Role key, checking Table Editor results.
- **Discord Developer Portal** — Creating the application, setting bot permissions, adding the bot to your server.
- **Azure Portal** (Teams only) — Creating the Bot Channels Registration, configuring the messaging endpoint.
- **Alexa Developer Console** (Alexa only) — Creating the custom skill, uploading the interaction model, configuring the HTTPS endpoint.
- **Connecting AI clients** — Adding the MCP connector in Claude Desktop, ChatGPT, or other clients (Settings menus in each app).

Your AI can tell you exactly what to click and where — it just can't click for you.

---

## Phase-by-Phase Workflow

### Phase 1: Core Infrastructure (Required)

**Source:** `docs/01-getting-started.md`

**What happens:**

1. Create a Supabase project
2. Run `schemas/core/schema.sql` in the SQL Editor (thoughts table, pgvector, vector search function, RLS)
3. Get your Project URL and Service Role Key
4. Get an OpenRouter API key
5. Generate an MCP access key (`openssl rand -hex 32`)
6. Deploy the MCP server Edge Function from `integrations/mcp-server/`
7. Set Supabase secrets (5 values)
8. Connect an AI client (Claude Desktop, ChatGPT, etc.)

**AI does:** Walks you through each SQL block, runs CLI commands, helps you deploy the Edge Function.

**You do:** Create accounts, copy credentials from dashboards, paste the MCP URL into your AI client settings.

**Verify before moving on:**

- Ask your AI client: "Capture this thought: Testing Cerebro setup"
- Then: "Search for testing"
- Both should work. If not, check Edge Function logs.

### Phase 2: Capture Sources (At Least One Required)

**Source:** `docs/SETUP.md` → Phase 2 options, then the individual guide for your choice

#### Option A: Discord (Recommended Starting Point)

**Source:** `docs/03-discord-capture-setup.md`

1. Create a Discord application at discord.com/developers
2. Set up a bot with MESSAGE_CONTENT intent
3. Deploy `integrations/discord-capture/` Edge Function
4. Set the Interactions Endpoint URL in Discord
5. Register slash commands via curl
6. Set Supabase secrets (DISCORD_PUBLIC_KEY, DISCORD_BOT_TOKEN)

**AI does:** Deploys the function, generates the curl command for slash command registration, debugs signature verification.

**You do:** Create the Discord app, enable intents, add bot to your server.

#### Option B: Microsoft Teams

**Source:** `docs/02-teams-capture-setup.md`

1. Register an Entra ID (Azure AD) app (Multitenant)
2. Create Azure Bot Channels Registration (F0 free tier)
3. Deploy `integrations/teams-capture/` Edge Function
4. Set the messaging endpoint
5. Create Teams app manifest and sideload
6. Set Supabase secrets (TEAMS_BOT_APP_ID, TEAMS_BOT_APP_SECRET)

**AI does:** Deploys the function, generates the manifest JSON, debugs JWT validation issues.

**You do:** Create Azure resources, configure Entra app, sideload in Teams Admin Center.

#### Option C: Alexa Voice

**Source:** `docs/04-alexa-setup.md`

1. Create custom skill in Alexa Developer Console
2. Upload interaction model from `integrations/alexa-capture/skill-package/`
3. Deploy `integrations/alexa-capture/` Edge Function
4. Set the HTTPS endpoint in the skill configuration
5. Set Supabase secrets

**AI does:** Deploys the function, walks you through interaction model upload.

**You do:** Create the Alexa skill, configure endpoints, test on your device.

**Verify before moving on:**

- Send a message in your capture source → bot replies with ✅ confirmation
- Check Supabase Table Editor → thought row exists with content, embedding, and metadata

### Phase 3: Calendar Reminders (Optional)

**Source:** `docs/05-reminders-setup.md`

1. (O365) Add `Calendars.ReadWrite` permission to your Entra app, grant admin consent
2. (Google) Create a service account, share your calendar with it
3. Set the relevant Supabase secrets
4. Redeploy capture Edge Functions

**AI does:** Walks through permission configuration, sets secrets, redeploys.

**You do:** Grant admin consent in Azure, share calendar in Google.

**Verify:** Send "Set a reminder for tomorrow at 9am to test Cerebro" → calendar event appears.

### Phase 4: Daily & Weekly Digest (Optional)

**Source:** `docs/06-daily-digest-setup.md`

1. Run `schemas/core/002-digest-channels.sql` and `003-digest-cron.sql` in SQL Editor
2. Deploy `integrations/daily-digest/` Edge Function
3. (Optional) Set up Resend for email delivery
4. Capture a few thoughts so digest has content

**AI does:** Deploys function, runs SQL, tests digest manually via curl.

**You do:** Create Resend account (if email wanted), verify email address.

**Verify:** Trigger digest manually → appears in your capture channel.

### Phase 5: File Attachments (Optional)

**Source:** `docs/07-file-attachments-setup.md`

1. Run `schemas/core/004-add-file-columns.sql`
2. Create `cerebro-files` storage bucket in Supabase Dashboard
3. Redeploy capture Edge Functions
4. (Discord only) Re-register slash commands with file option

**AI does:** Runs SQL, redeploys functions, generates updated curl command.

**You do:** Create the storage bucket in the dashboard.

**Verify:** Send a photo → bot replies with AI description of the image.

### Phase 6: Task Management (Optional)

**Source:** `docs/08-task-management-setup.md`

1. Run `schemas/core/005-add-status-column.sql`
2. Redeploy all Edge Functions
3. (Discord only) Re-register slash commands with task commands

**AI does:** Runs SQL, redeploys functions, generates curl command.

**You do:** Nothing extra — this phase is fully automated.

**Verify:** Capture a task, then "done: [task name]" → ✅ Marked done.

---

## Common Gotchas

### Don't let your AI improvise when it can't read the source

If your AI can't access a file or section, it may generate plausible but incorrect code rather than admitting it's stuck. All Cerebro code lives in this repo — if your AI is generating Edge Function code from scratch instead of referencing `integrations/`, stop it and point it to the actual file.

**Rule of thumb:** If it's not reading from `integrations/*/index.ts`, it's making it up.

### Configuration problems need configuration fixes

When something breaks, your AI's instinct is to rewrite code. Resist this. The Edge Function code in this repo works. Problems are almost always configuration:

- A secret that wasn't set (`supabase secrets list` to check)
- A URL that's missing the function path
- A Discord intent that wasn't enabled
- A Teams app that isn't set to Multitenant
- A step that got skipped

**Debug workflow:**

1. Check Edge Function logs: Supabase Dashboard → Edge Functions → your function → Logs
2. Paste the error to your AI
3. Let it diagnose — but don't let it rewrite the server code unless the logs point to an actual code bug

### Keep your credential tracker open

The [getting started guide](01-getting-started.md) has a credential tracker template near the top. **Copy it into a text file before you start.** Your AI can remind you to fill it in, but you need to save values somewhere accessible. If you skip this, you'll hit secrets setup and realize you don't have your Discord public key from three steps ago.

### Run schema migrations in order

The SQL files in `schemas/core/` must run in order:

1. `schema.sql` — Core thoughts table
2. `002-digest-channels.sql` — Digest channel tracking
3. `003-digest-cron.sql` — Scheduled digest jobs
4. `004-add-file-columns.sql` — File attachment columns
5. `005-add-status-column.sql` — Task status column

Skipping or reordering will cause errors. Only run the ones for features you're enabling.

### Test at every verification gate

Don't rush through all phases at once. Each phase has a verification step — do it. If capture works in Phase 2, you know your database, Edge Function, and integration are solid before adding complexity. Debugging a 6-phase stack is much harder than debugging one phase at a time.

---

## Tips

- **Go phase by phase.** Don't ask your AI to "set up everything." Walk through Phase 1, verify, then Phase 2. The guide is structured this way for a reason.
- **Use `supabase functions logs <function-name>`** to tail logs in real time while testing. Your AI can run this in a split terminal.
- **Use Supabase's built-in AI too.** The Supabase dashboard has its own AI assistant (chat icon, bottom-right). It knows Supabase docs and can help with anything database-specific.
- **Discord is the easiest starting capture source.** If you're not sure where to start, go Discord.
- **Phases 3–6 are all optional and independent.** You can add them in any order, or skip any you don't need.

---

## Quick Reference: Key Files

| File | What It Contains |
|------|-----------------|
| `docs/SETUP.md` | Master setup guide with prerequisites and decision tree |
| `docs/01-getting-started.md` | Phase 1 detailed walkthrough with all SQL and code |
| `schemas/core/*.sql` | Database migrations (run in order) |
| `integrations/mcp-server/index.ts` | MCP server Edge Function (7 tools) |
| `integrations/teams-capture/index.ts` | Teams bot Edge Function |
| `integrations/discord-capture/index.ts` | Discord bot Edge Function |
| `integrations/alexa-capture/index.ts` | Alexa skill Edge Function |
| `integrations/daily-digest/index.ts` | Digest generator Edge Function |
| `integrations/imessage-capture/index.ts` | iMessage capture Edge Function |
| `integrations/mcp-server-readonly/index.ts` | Read-only MCP server (OAuth) |
| `integrations/cloudflare-worker/src/index.ts` | OAuth discovery proxy (Cloudflare Worker) |
| `schemas/core/008-review-fixes.sql` | RLS policy, unique constraint, file\_type validation |
| `schemas/core/009-fix-cron-settings.sql` | Cron jobs with current\_setting fallback |

---

## After Setup

Once your Cerebro is running:

1. **Capture a dozen thoughts** across your active channels to build up initial content
2. **Ask your AI client** to search, summarize, and analyze your captured knowledge
3. **Set up digest delivery** so you get a daily summary of what you captured
4. **Explore the MCP tools** — your AI can search, list, complete tasks, and manage your brain

---

*This guide was inspired by the [Open Brain AI-assisted setup guide](https://github.com/NateBJones/OB1/blob/main/docs/04-ai-assisted-setup.md). If you deploy Cerebro using an AI coding tool, share how it went!*
