# Cerebro Setup Guide

The complete, step-by-step guide to deploying your Cerebro brain. Start with the core infrastructure, add your preferred capture sources, then layer on optional features.

**Time to first working system: ~30 minutes** (core + one capture source).

---

## Before You Start

Complete these prerequisites **before beginning any phase**. Having everything ready upfront prevents delays mid-setup.

### Required for Everyone

| Prerequisite | What to Do | Verify |
|-------------|-----------|--------|
| **GitHub account** | [Sign up](https://github.com) if you don't have one (free) — used to log into Supabase | You can log in to github.com |
| **Supabase account** | [Sign up at supabase.com](https://supabase.com) using GitHub login | You can access the Supabase dashboard |
| **OpenRouter account** | [Sign up at openrouter.ai](https://openrouter.ai) and [add $5 in credits](https://openrouter.ai/credits) | You have an API key at openrouter.ai/keys |
| **Terminal / command line** | Mac: Terminal app. Windows: PowerShell. Linux: any terminal | You can run `echo hello` and see output |
| **Supabase CLI installed** | Mac: `brew install supabase/tap/supabase`. Windows: `scoop install supabase`. Linux: `npm install -g supabase` | `supabase --version` prints a version number |
| **Node.js (for npx)** | [Download from nodejs.org](https://nodejs.org) if not installed — needed for some MCP client bridges | `node --version` prints v18+ |
| **An MCP-compatible AI client** | At least one of: Claude Desktop, ChatGPT (paid), Claude Code, Cursor, VS Code w/ Copilot | The app is installed and you can open it |
| **A text editor** | For the credential tracker — Notepad, Notes app, VS Code, anything | You can paste and save text |

### Required Per Feature (gather these before starting that phase)

Review the decision tree below, decide which features you want, and make sure you have the prerequisites for each **before** you start.

| Feature | Prerequisites |
|---------|--------------|
| **Discord capture** | Discord account (free) + a Discord server you own or have admin access to |
| **Teams capture** | Microsoft 365 tenant with Teams + Azure subscription (free tier works) + M365 admin access to enable sideloading |
| **Alexa capture** | Amazon account (same one linked to your Alexa/Echo devices) + [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) account (free, same Amazon login) |
| **O365 Calendar reminders** | Microsoft Entra ID app registration (created during Teams setup, or create a new one) + O365 mailbox for events + M365 admin to grant consent |
| **Google Calendar reminders** | Google Cloud account (free tier) + personal or Workspace Gmail for the target calendar |
| **Daily/Weekly Digest** | At least one capture source (Discord or Teams) already set up and working with thoughts captured |
| **Digest email delivery** | [Resend account](https://resend.com) (free — 100 emails/day) |
| **File Attachments** | Supabase Storage bucket | Free (1 GB included) |

> **Tip:** If you're setting up Teams capture AND O365 calendar reminders, you'll reuse the same Entra ID app registration for both — just add the `Calendars.ReadWrite` permission when you get to Phase 3.

---

## Architecture Overview

```
                         ┌─────────────────────────┐
                         │      Supabase            │
                         │  ┌───────────────────┐   │
                         │  │  PostgreSQL        │   │
┌──────────────────┐     │  │  + pgvector        │   │     ┌──────────────────┐
│  Capture Sources │     │  │  + pg_cron         │   │     │  AI Clients      │
│                  │     │  └───────────────────┘   │     │                  │
│  Discord ────────┼────▶│                          │◀────┼── Claude Desktop │
│  Teams ──────────┼────▶│  Edge Functions:          │◀────┼── ChatGPT       │
│  Alexa ──────────┼────▶│   cerebro-mcp            │◀────┼── Claude Code   │
│  MCP Clients ────┼────▶│   cerebro-discord         │     │   Cursor        │
│                  │     │   cerebro-teams           │     └──────────────────┘
└──────────────────┘     │   cerebro-alexa           │
                         │   cerebro-digest          │
                         │                          │
                         │  OpenRouter (AI gateway)  │
                         └─────────────────────────┘
```

---

## Decision Tree

Use this to plan which features you'll set up. **Phase 1 and Phase 2 are required.** Everything else is optional.

```
START HERE
    │
    ▼
╔═══════════════════════════════════╗
║  PHASE 1: Core Infrastructure    ║  ◀── REQUIRED
║  Supabase + OpenRouter + MCP     ║
║  ~20 minutes                     ║
╚═══════════════╤═══════════════════╝
                │
         ✅ Verify: capture + search
         ✅ via MCP client works
                │
                ▼
╔═══════════════════════════════════╗
║  PHASE 2: Capture Source(s)      ║  ◀── AT LEAST ONE REQUIRED
╠═══════════════════════════════════╣
║                                   ║
║  Choose one or more:              ║
║  ┌───────────┐  ┌───────────┐    ║
║  │  Discord   │  │  Teams    │    ║
║  │  (free)    │  │  (O365)   │    ║
║  └─────┬─────┘  └─────┬─────┘    ║
║        │               │          ║
║        ▼               ▼          ║
║     Optional:                     ║
║  ┌───────────────────────┐       ║
║  │  Alexa Voice Capture  │       ║
║  │  (Amazon account)     │       ║
║  └───────────────────────┘       ║
╚═══════════════╤═══════════════════╝
                │
         ✅ Verify: capture + search
         ✅ via chosen source(s)
                │
                ▼
    ┌───── OPTIONAL FEATURES ─────┐
    │                              │
    ▼                              │
╔══════════════════════╗           │
║  Calendar Reminders  ║           │
║  O365 / Google Cal   ║           │
╚══════════╤═══════════╝           │
           │                       │
    ✅ Verify: date in             │
    ✅ capture → event             │
           │                       │
           ▼                       │
╔══════════════════════╗           │
║  Daily/Weekly Digest ║           │
║  → Chat channels     ║           │
╚══════════╤═══════════╝           │
           │                       │
    ✅ Verify: manual              │
    ✅ trigger → delivery          │
           │                       │
           ▼                       │
   ┌───────────────────┐          │
   │  + Email Delivery │          │
   │  (Resend — free)  │          │
   └───────┬───────────┘          │
           │                       │
           ▼                       │
╔══════════════════════╗           │
║  File Attachments    ║           │
║  AI vision + storage ║           │
╚══════════╤═══════════╝           │
           │                       │
    ✅ Verify: file scan           │
    ✅ + storage works             │
           │                       │
           DONE! ◀─────────────────┘
```

---

## Master Credential Tracker

Copy this into a text editor and fill it in as you complete each phase. You'll reference these values throughout setup.

```text
CEREBRO — MASTER CREDENTIAL TRACKER
Keep this file safe. Fill in as you go.
════════════════════════════════════════

PHASE 1: CORE INFRASTRUCTURE
─────────────────────────────
SUPABASE
  Account email:       ____________
  Database password:   ____________
  Project ref:         ____________
  Project URL:         ____________
  Service role key:    ____________

OPENROUTER
  API key:             ____________

GENERATED
  MCP Access Key:      ____________
  MCP Server URL:      ____________
  MCP Connection URL:  ____________

PHASE 2: CAPTURE SOURCES
─────────────────────────
DISCORD (if using)
  Application ID:      ____________
  Public Key:          ____________
  Bot Token:           ____________

TEAMS (if using)
  App (client) ID:     ____________
  Client secret:       ____________
  Tenant ID:           ____________
  Bot handle:          ____________

ALEXA (if using)
  Skill ID:            ____________
  Function URL:        ____________

PHASE 3: CALENDAR REMINDERS
────────────────────────────
O365 (if using)
  GRAPH_TENANT_ID:     ____________
  GRAPH_CLIENT_ID:     ____________
  GRAPH_CLIENT_SECRET: ____________
  CALENDAR_USER_EMAIL: ____________

GOOGLE (if using)
  GOOGLE_CALENDAR_ID:  ____________
  Service account JSON: (stored separately)

PHASE 4: DIGEST + EMAIL
────────────────────────
RESEND (if using email)
  API key:             ____________
  From address:        ____________
  To address(es):      ____________

════════════════════════════════════════
```

---

## Phase 1: Core Infrastructure (REQUIRED)

> **What you'll build:** A Supabase database with vector embeddings, an MCP server that lets any AI assistant capture and search your thoughts, and connections to your AI tools.

### Prerequisites Checklist

Before starting Phase 1, confirm you have:

- [ ] Supabase account created and you can access the dashboard
- [ ] OpenRouter account created with $5+ credits loaded
- [ ] Supabase CLI installed (`supabase --version` works in your terminal)
- [ ] An MCP-compatible AI client installed (Claude Desktop, ChatGPT, Claude Code, etc.)
- [ ] Your credential tracker file open and ready

### Steps

Follow the complete guide: **[Getting Started →](01-getting-started.md)**

This covers:
1. Create a Supabase project (free tier)
2. Set up the database (thoughts table, vector search, security)
3. Get an OpenRouter API key (AI gateway)
4. Generate an access key
5. Deploy the MCP server Edge Function
6. Connect to your AI client (Claude Desktop, ChatGPT, Claude Code, Cursor)

### 🚦 Verification Gate

Do NOT proceed until all of these pass:

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Visit `https://YOUR_REF.supabase.co/functions/v1/cerebro-mcp` in browser | Page loads (not 404/500) |
| 2 | In your AI client: "Remember this: testing Cerebro setup" | Confirmation with extracted metadata |
| 3 | In your AI client: "What did I capture about testing?" | Returns the thought you just captured |
| 4 | Supabase Dashboard → Table Editor → `thoughts` | At least 1 row with `metadata.source = "mcp"` |

✅ **All 4 pass?** Continue to Phase 2.

---

## Phase 2: Capture Sources (AT LEAST ONE REQUIRED)

> **What you'll build:** One or more chat-based entry points so you can capture thoughts from your phone, desktop, or voice — not just your AI coding tools.

### Prerequisites Checklist

Before starting Phase 2, confirm:

- [ ] **Phase 1 is complete** — all 4 verification gate tests pass
- [ ] You've decided which capture source(s) to set up (see prerequisites table in "Before You Start")
- [ ] You have the required accounts for your chosen source(s):
  - **Discord:** Discord account + a server you own/admin
  - **Teams:** M365 tenant + Azure subscription + M365 admin access
  - **Alexa:** Amazon account + Alexa Developer Console account

Choose at least one capture source. You can add more later.

### Option A: Discord (Recommended Starting Point)

**What you need:** A Discord account (free) and a Discord server you control.

**What you get:** `/capture` and `/search` slash commands that work on desktop, mobile, and web.

Follow the complete guide: **[Discord Setup →](03-discord-capture-setup.md)**

#### 🚦 Verification Gate

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | `/capture thought:testing Discord integration` | "Thinking..." → confirmation with metadata |
| 2 | `/search query:testing` | Returns matching thoughts with similarity scores |
| 3 | Supabase → `thoughts` table | New row with `metadata.source = "discord"` |
| 4 | Visit Edge Function URL in browser | `{"status":"ok","service":"cerebro-discord"}` |

---

### Option B: Microsoft Teams

**What you need:** Microsoft 365 tenant with Teams, Azure subscription (Bot is free F0 tier), admin access for sideloading.

**What you get:** DM the bot or @mention it in any Teams channel. Works on desktop, web, iOS, and Android.

Follow the complete guide: **[Teams Setup →](02-teams-capture-setup.md)**

#### 🚦 Verification Gate

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | DM the Cerebro bot: "testing Teams integration" | Confirmation reply with extracted metadata |
| 2 | @mention in a channel: "@Cerebro architecture review" | Threaded reply with confirmation |
| 3 | Supabase → `thoughts` table | New rows with `metadata.source = "teams"` |
| 4 | Visit Edge Function URL in browser | `{"status":"ok","service":"cerebro-teams"}` |

---

### Option C: Alexa Voice Capture (Additional)

> **Note:** Alexa is best added alongside Discord or Teams, since it can't receive push notifications (digests). It's great for hands-free capture and queries.

**What you need:** Amazon account (same as your Alexa devices), Alexa Developer Console account (free).

**What you get:** "Alexa, tell cerebro ..." — capture, search, task management, stats, and digest queries by voice.

Follow the complete guide: **[Alexa Setup →](04-alexa-setup.md)**

#### 🚦 Verification Gate

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Simulator: "open cerebro" | "Welcome to Cerebro..." |
| 2 | Simulator: "tell cerebro I need to buy groceries" | "Captured: I need to buy groceries. Tagged as task." |
| 3 | Simulator: "ask cerebro about groceries" | "I found 1 result..." |
| 4 | Supabase → `thoughts` table | New row with `metadata.source = "alexa"` |

---

✅ **At least one capture source verified?** Your Cerebro is fully functional. The features below are optional enhancements.

---

## Phase 3: Calendar Reminders (OPTIONAL)

> **What you'll build:** Automatic calendar event creation when you capture a thought that mentions a future date or time. Works across ALL capture sources.

### Prerequisites Checklist

Before starting Phase 3, confirm:

- [ ] **Phase 1 is complete** — core infrastructure verified
- [ ] **At least one capture source works** — Phase 2 verification gate passed
- [ ] You have the accounts/access for your chosen calendar(s):
  - **O365 Calendar:** Entra ID app registration (from Teams setup or new), M365 admin access to grant `Calendars.ReadWrite` consent, an O365 mailbox for events
  - **Google Calendar:** Google Cloud account, a Gmail/Google Calendar to target

**What you need:** Office 365 calendar and/or Google Calendar.

**Example:** Saying "remind me to check the deployment logs next Friday at 10am" from any capture source → event appears on your calendar.

Follow the complete guide: **[Reminders Setup →](05-reminders-setup.md)**

### 🚦 Verification Gate

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Capture: "remind me to call the dentist next Wednesday at 5 AM" | Confirmation includes "⏰ Reminder created on ..." |
| 2 | Check your calendar app | Event appears for next Wednesday at 5:00 AM |
| 3 | Supabase → thought's `metadata` | Contains `has_reminder: true`, `reminder_title`, `reminder_datetime` |
| 4 | Capture: "I like PostgreSQL" (no date) | No calendar event created (correctly ignored) |

---

## Phase 4: Daily & Weekly Digest (OPTIONAL)

> **What you'll build:** Automated daily and weekly summaries delivered to your chat channels (Teams, Discord, or both). Optionally adds email delivery.

### Prerequisites Checklist

Before starting Phase 4, confirm:

- [ ] **Phase 1 is complete** — core infrastructure verified
- [ ] **At least one capture source works** — Phase 2 verification gate passed
- [ ] **You have captured several thoughts** — the digest needs content to summarize (at least 5-10 thoughts recommended)
- [ ] (For email) You have a [Resend account](https://resend.com) created (free tier)

**What you need:** Core setup + at least one capture source with some thoughts captured.

The daily digest runs every morning (6 AM Central) with a concise summary. The weekly digest runs Sundays (noon Central) with deeper pattern analysis.

Follow the complete guide: **[Digest Setup →](06-daily-digest-setup.md)**

### 🚦 Verification Gate — Channel Delivery

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Capture several thoughts first (need content to summarize) | Multiple rows in `thoughts` table |
| 2 | `curl -X POST https://YOUR_REF.supabase.co/functions/v1/cerebro-digest -H "Content-Type: application/json" -d '{"period":"daily"}'` | JSON response with `"success": true` |
| 3 | Check your Discord/Teams channel | Digest message appears |
| 4 | `select * from digest_channels;` | Rows for your active channels with `enabled = true` |
| 5 | `select * from cron.job;` | Shows `cerebro-daily-digest` and `cerebro-weekly-digest` |

### Sub-Option: Email Delivery

Want the digest in your inbox too? Add Resend (free — 100 emails/day, 3,000/month).

This is covered in the digest guide under **Email Setup with Resend**.

#### 🚦 Verification Gate — Email

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Set `RESEND_API_KEY`, `DIGEST_EMAIL_TO`, `DIGEST_EMAIL_FROM` | Secrets set successfully |
| 2 | Manually trigger: `curl -X POST ... -d '{"period":"daily"}'` | JSON shows email delivery in response |
| 3 | Check your inbox | HTML-styled digest email with gradient header |

---

## Phase 5: File Attachments (OPTIONAL)

> **Goal:** Scan images, PDFs, and documents posted in Teams or Discord.

### Prerequisites Checklist

- [ ] Phase 1 complete (core infrastructure)
- [ ] At least one capture source working (Teams or Discord)
- [ ] Supabase Storage bucket not yet created

### Steps

1. Run schema migration: `schemas/core/004-add-file-columns.sql`
2. Create `cerebro-files` storage bucket in Supabase Dashboard
3. Redeploy capture Edge Functions
4. (Discord only) Re-register slash commands with file option

📖 Full guide → [File Attachments Setup](07-file-attachments-setup.md)

### 🚦 Verification Gate

- [ ] Send an image to Teams/Discord → bot replies with AI description
- [ ] Send a PDF → content is scanned and captured
- [ ] "Remove file" button works → file deleted, scan text preserved
- [ ] `list_thoughts` with `has_file: true` returns file thoughts only

---

## You're Done! 🎉

Your Cerebro brain is now operational. Here's what you've built:

| Component | Status |
|-----------|--------|
| Core database + vector search | ✅ Required |
| MCP server for AI tools | ✅ Required |
| Capture source(s) | ✅ Required (1+) |
| Calendar reminders | Optional |
| Daily/weekly digest | Optional |
| Email delivery | Optional |
| File attachments | Optional |

### Tips for Daily Use

- **Capture everything** — random thoughts, meeting notes, decisions, ideas. The AI extracts structure automatically.
- **Search by meaning** — "What did I decide about the database?" finds thoughts about PostgreSQL choices even if you never said "database."
- **Mix sources** — capture from Discord on your phone, Teams on your desktop, Alexa while walking. It all goes to the same brain.
- **Review your digests** — the weekly digest surfaces patterns you might miss day-to-day.

---

## Appendix A: Full Environment Variable Reference

| Variable | Set In | Used By | Required |
|----------|--------|---------|----------|
| `MCP_ACCESS_KEY` | Phase 1 | MCP server | Yes |
| `OPENROUTER_API_KEY` | Phase 1 | All functions | Yes |
| `DISCORD_PUBLIC_KEY` | Phase 2 | Discord capture | If using Discord |
| `DISCORD_BOT_TOKEN` | Phase 2 | Discord capture + Digest | If using Discord |
| `TEAMS_BOT_APP_ID` | Phase 2 | Teams capture + Digest | If using Teams |
| `TEAMS_BOT_APP_SECRET` | Phase 2 | Teams capture + Digest | If using Teams |
| `ALEXA_SKILL_ID` | Phase 2 | Alexa capture | Recommended |
| `GRAPH_TENANT_ID` | Phase 3 | Calendar reminders | If using O365 cal |
| `GRAPH_CLIENT_ID` | Phase 3 | Calendar reminders | If using O365 cal |
| `GRAPH_CLIENT_SECRET` | Phase 3 | Calendar reminders | If using O365 cal |
| `CALENDAR_USER_EMAIL` | Phase 3 | Calendar reminders | If using O365 cal |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Phase 3 | Calendar reminders | If using Google cal |
| `GOOGLE_CALENDAR_ID` | Phase 3 | Calendar reminders | If using Google cal |
| `RESEND_API_KEY` | Phase 4 | Digest email | If using email |
| `DIGEST_EMAIL_TO` | Phase 4 | Digest email | If using email |
| `DIGEST_EMAIL_FROM` | Phase 4 | Digest email | If using email |

> **Note:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in all Supabase Edge Functions.
>
> **Note:** File Attachments (Phase 5) requires no new environment variables — it uses existing Supabase credentials and the `OPENROUTER_API_KEY` already configured in Phase 1.

---

## Appendix B: Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 404 on Edge Function URL | Function not deployed | `supabase functions deploy <name> --no-verify-jwt` |
| 401 from MCP server | Wrong access key | Check `MCP_ACCESS_KEY` matches your URL `?key=` param |
| Tools don't appear in Claude | Connector not added | Settings → Connectors → add the MCP Connection URL |
| Discord commands missing | Propagation delay | Global commands take up to 1 hour; use guild-specific for instant |
| Teams bot no reply | Wrong messaging endpoint | Azure Bot → Configuration → verify URL matches function |
| Alexa "problem with skill" | Function error | `supabase functions logs cerebro-alexa --project-ref YOUR_REF` |
| Calendar event not created | Missing credentials | `supabase secrets list` — check GRAPH_* or GOOGLE_* vars |
| Digest not delivered | No registered channels | Capture a thought from Teams/Discord first to auto-register |
| Cron not firing | Extensions disabled | Enable `pg_cron` and `pg_net` in Supabase Dashboard |
| Email not received | Resend domain restriction | Default `onboarding@resend.dev` only sends to account owner |

---

## Appendix C: Edge Functions Reference

| Function | Endpoint | Deploy Command |
|----------|----------|---------------|
| MCP Server | `cerebro-mcp` | `supabase functions deploy cerebro-mcp --no-verify-jwt` |
| Discord | `cerebro-discord` | `supabase functions deploy cerebro-discord --no-verify-jwt` |
| Teams | `cerebro-teams` | `supabase functions deploy cerebro-teams --no-verify-jwt` |
| Alexa | `cerebro-alexa` | `supabase functions deploy cerebro-alexa --no-verify-jwt` |
| Digest | `cerebro-digest` | `supabase functions deploy cerebro-digest --no-verify-jwt` |

**Redeploy all functions after code changes:**

```bash
supabase functions deploy cerebro-mcp --no-verify-jwt && \
supabase functions deploy cerebro-discord --no-verify-jwt && \
supabase functions deploy cerebro-teams --no-verify-jwt && \
supabase functions deploy cerebro-alexa --no-verify-jwt && \
supabase functions deploy cerebro-digest --no-verify-jwt
```
