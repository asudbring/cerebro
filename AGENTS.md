# AGENTS.md — AI Agent Instructions for Cerebro

> This file provides instructions for AI coding agents (GitHub Copilot, Claude Code, Cursor, Windsurf, Codex, etc.) working in this repository.

## Project Overview

Cerebro is a cloud-based personal knowledge store. It pairs a Supabase PostgreSQL database (with pgvector for semantic search) with an MCP server and multiple capture integrations so that any AI client can store, search, and manage thoughts.

- **Repository:** github.com/asudbring/cerebro
- **License:** FSL-1.1-MIT (no commercial derivatives for 2 years)
- **Inspired by:** [Open Brain](https://github.com/NateBJones/OB1) by Nate B. Jones

## Architecture

```text
┌──────────────┐┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Teams Bot  │  │ Discord Bot  │  │  Alexa Skill │  │iMessage (BB) │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       └────────────┬────┴────────┬────────┘                 │
                    ▼             ▼                          ▼
            ┌──────────────────────────┐   ┌──────────────────────────┐
            │   Supabase Edge Functions│   │  BlueBubbles (Mac) +     │
            │   (Deno + Hono)          │   │  Cloudflare Named Tunnel │
            └──────────┬───────────────┘   └──────────┬───────────────┘
                       │                              │
                       ▼                              ▼
              ┌─────────────────────────────────────────────┐
              │  Supabase PostgreSQL + pgvector              │
              │  thoughts table (1536-dim embeddings)        │
              └─────────────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────────────────┐
              │  OpenRouter AI Gateway       │
              │  - text-embedding-3-small    │
              │  - gpt-4o-mini (metadata)    │
              │  - gemini-2.0-flash (PDFs)   │
              │  - gpt-4o-mini (vision)      │
              └─────────────────────────────┘

Read-Only MCP path (OAuth):
  MCP Client → Cloudflare Worker (mcp.yourdomain.com)
    → OAuth discovery (/.well-known/*) served locally
    → MCP requests proxied to Supabase Edge Function
    → Token validation via Entra ID JWKS
```

### Supabase Project

- **Project ref:** `YOUR_PROJECT_REF` (set during Supabase project creation)
- **7 Edge Functions:** cerebro-mcp, cerebro-mcp-readonly, cerebro-teams, cerebro-discord, cerebro-alexa, cerebro-imessage, cerebro-digest
- **Auth:** `x-brain-key` header (primary MCP); OAuth 2.1 via Entra ID through Cloudflare Worker proxy (both servers). Primary server supports dual auth (OAuth + API key).
- **All functions** use Deno + Hono framework, deployed via `npx supabase functions deploy <name> --no-verify-jwt`

### Mac Server (iMessage Infrastructure)

- **Host:** mac-server.example.com (Intel x86_64, macOS 15.7.4)
- **BlueBubbles:** v1.9.9, Private API disabled, standard API only (SIP remains enabled)
- **Cloudflare tunnel:** `bb.example.com` → localhost:1234 (named tunnel `cerebro-bb`)
- **Launchd service:** `/Library/LaunchDaemons/com.cloudflare.cerebro-bb.plist`
- **No Homebrew** — use direct binary downloads for package installs on this Mac

## Repository Structure

```text
cerebro/
├── docs/                        # Setup guides (01 through 11)
├── extensions/                  # Feature extensions (future)
├── integrations/
│   ├── mcp-server/              # Core MCP server (7 tools, dual auth: OAuth + x-brain-key header)
│   ├── mcp-server-readonly/     # Read-only MCP server (3 tools, OAuth via Entra ID)
│   ├── cloudflare-worker/       # OAuth proxy (mcp.yourdomain.com) — CORS allowlist, path traversal protection
│   ├── teams-capture/           # Microsoft Teams bot (Bot Framework)
│   ├── discord-capture/         # Discord bot (slash commands)
│   ├── alexa-capture/           # Alexa voice skill (HTTPS endpoint)
│   ├── imessage-capture/        # iMessage via BlueBubbles webhooks
│   └── daily-digest/            # Daily/weekly digest generator + delivery
├── schemas/
│   └── core/                    # SQL migrations (schema.sql, 002–009)
├── scripts/
│   └── dbsql.py                 # Pure-Python PostgreSQL client
├── supabase/                    # Deployment copies (gitignored internals)
├── .env                         # Database credentials (gitignored)
├── CLAUDE.md                    # Agent instructions (legacy, kept for compat)
├── AGENTS.md                    # This file
└── README.md
```

## Guard Rails

**DO:**

- Add new columns to the `thoughts` table when needed
- Use Supabase Secrets for all credentials (`npx supabase secrets set KEY=VALUE`)
- Deploy all server functions as Supabase Edge Functions
- Use sequential numbered migrations (e.g., `008-feature-name.sql`)
- Run migrations via `npx supabase db query --linked < schemas/core/NNN-name.sql` or `python3 scripts/dbsql.py -f schemas/core/NNN-name.sql`
- Copy integration source to `supabase/functions/<name>/` before deploying (containers don't follow symlinks)

**DO NOT:**

- Alter, rename, or drop existing columns on the `thoughts` table — every integration depends on the current schema
- Commit secrets, API keys, or passwords to source
- Use `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, or unqualified `DELETE FROM` in SQL files
- Add binary files over 1 MB to the repo
- Introduce local servers, stdio transports, or `claude_desktop_config.json` setups
- Use `psql` to connect to the database (broken — use Supabase CLI or `scripts/dbsql.py` instead)

## Database Access

**`psql` does NOT work** with this Supabase instance due to a libpq SCRAM-SHA-256 incompatibility with Supabase's Supavisor pooler.

### Preferred: Supabase CLI (no credentials file needed)

```bash
# Run a query
npx supabase db query "SELECT count(*) FROM thoughts" --linked

# Run a migration file (PowerShell)
Get-Content schemas/core/008-review-fixes.sql | npx supabase db query --linked

# Run a migration file (bash)
npx supabase db query --linked < schemas/core/008-review-fixes.sql
```

The CLI uses the linked project auth — no `.env` file required.

### Alternative: Pure-Python client (requires .env)

```bash
# Run a query
python3 scripts/dbsql.py "SELECT count(*) FROM thoughts"

# Run a migration file
python3 scripts/dbsql.py -f schemas/core/007-source-message-id.sql

# Pipe SQL
echo "SELECT * FROM thoughts LIMIT 5" | python3 scripts/dbsql.py
```

Credentials auto-load from `.env` in the project root. Connection details:

- **Host:** aws-0-us-west-2.pooler.supabase.com (session pooler)
- **Port:** 5432
- **User:** `postgres.YOUR_PROJECT_REF`
- **Database:** postgres
- The direct hostname (`db.YOUR_PROJECT_REF.supabase.co`) requires IPv6 and won't resolve on most networks

## Database Schema

The `thoughts` table is the core data store:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key (auto-generated) |
| content | text | The thought content |
| embedding | vector(1536) | Semantic embedding (text-embedding-3-small) |
| metadata | jsonb | Topics, type, source, person mentions, actions |
| status | text | `open`, `done`, or `deleted` |
| source_message_id | text | Original message ID for deduplication |
| file_url | text | Supabase Storage URL for attachments |
| file_type | text | MIME type of attachment |
| created_at | timestamptz | Auto-set |

**Key RPC function:** `match_thoughts(query_embedding, match_threshold, match_count)` — vector similarity search.

### Migration Conventions

- Files in `schemas/core/` named `NNN-description.sql` (e.g., `007-source-message-id.sql`)
- Always use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- Never destructive — no DROP, TRUNCATE, or unqualified DELETE

## Edge Function Development

### Pattern

All Edge Functions follow this structure:

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";

const app = new Hono();
app.post("*", async (c) => { /* handler */ });
Deno.serve(app.fetch);
```

**Critical:** Route must be `app.post("*")` not `app.post("/")` — Supabase path matching requires the wildcard.

### Deployment

```bash
# 1. Copy source to deploy directory
cp integrations/<name>/index.ts supabase/functions/<name>/index.ts

# 2. Deploy
npx supabase functions deploy <name> --no-verify-jwt

# 3. Set secrets (if new env vars added)
npx supabase secrets set KEY=VALUE
```

### DNS Resolution Workaround

When calling the Supabase REST API from environments with DNS issues, use:

```bash
curl --resolve YOUR_PROJECT_REF.supabase.co:443:CLOUDFLARE_IP \
  "https://YOUR_PROJECT_REF.supabase.co/rest/v1/..."
```

## Capture Source Details

### Teams (cerebro-teams)

- Azure Bot Framework, single-tenant
- Entra ID app: `<your-teams-bot-app-id>`
- Tenant: `<your-entra-tenant-id>`

### Discord (cerebro-discord)

- Application ID: `<your-discord-app-id>`
- Uses slash commands (`/capture`, `/search`, `/stats`, etc.)

### Alexa (cerebro-alexa)

- Custom skill, HTTPS endpoint
- Invocation: "my brain"
- 6 intents: CaptureThought, Search, Stats, BrowseRecent, CompleteTask, ReopenTask

### iMessage (cerebro-imessage)

- BlueBubbles Server on Mac → Cloudflare named tunnel → Edge Function
- Text-based commands (no slash commands): capture, `search <query>`, `stats`, `done <desc>`, `reopen <desc>`, `delete <desc>`, `help`
- Commands accept both colon and space delimiters: `done passport` or `done:passport`
- Loop prevention: zero-width space (`\u200B`) prefix on all bot replies + emoji prefix detection
- Stale message guard: ignores messages older than 5 minutes (prevents webhook replay spam)
- Deduplication: `source_message_id` column prevents same message processed twice
- BlueBubbles API: `message` field (not `text`), `tempGuid` required, `method: "apple-script"`
- Self-chat creates TWO chat GUIDs (phone + email) — both must be in `BLUEBUBBLES_ALLOWED_CHATS`

### Daily Digest (cerebro-digest)

- Generates daily/weekly summaries via AI
- Delivers via email (Resend), Teams, Discord, and iMessage
- Email recipients: configured via `DIGEST_EMAIL_RECIPIENTS` environment variable
- Scheduled via pg_cron in Supabase

## Known Issues & Workarounds

### psql / libpq Cannot Connect

All libpq-based tools (psql, psycopg2, psycopg3) fail with "server closed the connection unexpectedly" against Supabase's Supavisor pooler. **Use `npx supabase db query --linked` or `scripts/dbsql.py` instead.**

### BlueBubbles macOS Automation Permission (-1743)

On macOS Sequoia 15, BlueBubbles cannot send AppleEvents to Messages (Electron TCC issue). Fix: manually insert into user-level TCC database from Terminal.app with Full Disk Access:

```bash
sqlite3 ~/Library/Application\ Support/com.apple.TCC/TCC.db "INSERT OR REPLACE INTO access (...) VALUES ('kTCCServiceAppleEvents', 'com.BlueBubbles.BlueBubbles-Server', 0, 2, 4, 1, <csreq_blob>, NULL, 0, 'com.apple.MobileSMS', NULL, 0, ...);"
```

Full script at `~/Desktop/fix-bluebubbles-tcc.sh` on mac-server. Must quit and reopen BlueBubbles after.

### BlueBubbles Webhook Replay

BlueBubbles replays old messages as new webhooks on restart. The Edge Function guards against this with a 5-minute message age check and source_message_id deduplication.

### Supabase Edge Function Route

Must use `app.post("*")` not `app.post("/")` — Supabase strips paths during routing.

### Supabase Deploy Directory

Files in `supabase/functions/<name>/` must be actual copies, not symlinks. The Supabase container doesn't follow symlinks.

## Environment Variables (Supabase Secrets)

These are set via `npx supabase secrets set` and available in Edge Functions:

| Variable | Used By | Description |
|----------|---------|-------------|
| SUPABASE_URL | All | Auto-set by Supabase |
| SUPABASE_SERVICE_ROLE_KEY | All | Auto-set by Supabase |
| OPENROUTER_API_KEY | All | OpenRouter API key for AI models |
| BRAIN_ACCESS_KEY | mcp-server | MCP access key for x-brain-key auth |
| BOT_APP_ID | teams | Azure Bot Framework app ID |
| BOT_APP_PASSWORD | teams | Azure Bot Framework password |
| BOT_TENANT_ID | teams | Azure AD tenant ID |
| DISCORD_APP_ID | discord | Discord application ID |
| DISCORD_PUBLIC_KEY | discord | Discord interaction verification key |
| DISCORD_BOT_TOKEN | discord | Discord bot token |
| ALEXA_SKILL_ID | alexa | Alexa skill ID for request validation |
| BLUEBUBBLES_URL | imessage, digest | `https://bb.yourdomain.com` |
| BLUEBUBBLES_PASSWORD | imessage, digest | BlueBubbles server password |
| BLUEBUBBLES_ALLOWED_CHATS | imessage | Comma-separated chat GUIDs |
| GRAPH_TENANT_ID | teams, imessage | Microsoft Graph tenant ID |
| GRAPH_CLIENT_ID | teams, imessage | Microsoft Graph app ID |
| GRAPH_CLIENT_SECRET | teams, imessage | Microsoft Graph secret |
| GRAPH_USER_ID | teams, imessage | O365 user ID for calendar |
| GOOGLE_SERVICE_ACCOUNT_JSON | teams, imessage | Google Calendar credentials |
| GOOGLE_CALENDAR_ID | teams, imessage | Google Calendar ID |
| RESEND_API_KEY | digest | Resend email API key |

## Coding Conventions

- **Runtime:** Deno (Edge Functions), TypeScript
- **Framework:** Hono for HTTP routing
- **Database client:** `@supabase/supabase-js` with service role key
- **AI calls:** Direct fetch to OpenRouter API (`https://openrouter.ai/api/v1`)
- **Error handling:** Try/catch with user-facing error replies, console.error for logging
- **No local dependencies** — all imports from JSR or npm specifiers in Deno
- **Comments:** Only where behavior is non-obvious; no boilerplate comments

## Related Projects

- **[cerebro-onprem](https://github.com/asudbring/cerebro-onprem)** — Fully self-hosted version using Docker (PostgreSQL, MinIO, Express.js) + Ollama for local AI. 1:1 feature parity with this cloud version.
