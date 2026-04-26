# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **See also:** `AGENTS.md` for detailed architecture, infrastructure specifics, environment variables, known issues, and integration-specific notes. **When making changes, update both CLAUDE.md, AGENTS.md, and any relevant docs/ files to keep documentation in sync.**

## What This Repo Is

Cerebro is a cloud-based personal knowledge store. Supabase (PostgreSQL + pgvector) stores thoughts with 1536-dim embeddings. An MCP server exposes 12 tools — 7 core (`search_thoughts`, `list_thoughts`, `thought_stats`, `capture_thought`, `complete_task`, `reopen_task`, `delete_task`) and 5 publishing (`search_series_bible`, `search_style_guide`, `search_editorial_history`, `search_cover_specs`, `capture_publishing`). Multiple capture channels (Discord, Teams, Alexa, iMessage) all write to the same `thoughts` table, plus a daily Microsoft Graph sweep (`cerebro-graph-ingest`) that auto-pulls Outlook mail, calendar, OneNote, and OneDrive/SharePoint with an AI gatekeeper. Four publishing collections (`cerebro_series_bible`, `cerebro_style_guide`, `cerebro_editorial_history`, `cerebro_cover_specs`) support AI-powered fiction editing pipelines.

**License:** FSL-1.1-MIT. No commercial derivative works for the first 2 years.

## Common Commands

### Deploying Edge Functions

```bash
# Copy source then deploy (containers don't follow symlinks)
cp integrations/<name>/index.ts supabase/functions/<name>/index.ts
cp integrations/<name>/deno.json supabase/functions/<name>/deno.json
npx supabase functions deploy <name> --no-verify-jwt

# Set secrets when adding new env vars
npx supabase secrets set KEY=VALUE
```

### Database Queries & Migrations

```bash
# psql does NOT work — use Supabase CLI or dbsql.py

# Query via Supabase CLI (preferred, no .env needed)
npx supabase db query "SELECT count(*) FROM thoughts" --linked

# Run a migration file
npx supabase db query --linked < schemas/core/NNN-name.sql

# Alternative: Pure-Python client (reads .env)
python3 scripts/dbsql.py "SELECT count(*) FROM thoughts"
python3 scripts/dbsql.py -f schemas/core/NNN-name.sql
```

### Linting

```bash
# Markdown lint (runs in CI on push to main and PRs)
npx markdownlint-cli2 "**/*.md"
```

Markdownlint config is at `.github/.markdownlint.jsonc`. Disabled rules: MD013 (line length), MD033 (inline HTML), MD041 (first line heading), MD060.

### Cloudflare Worker

```bash
cd integrations/cloudflare-worker
npx wrangler deploy
```

## Architecture

```text
Discord / Teams / Alexa / iMessage → Supabase Edge Functions (Deno + Hono)
                                          ↓
                                    PostgreSQL + pgvector (thoughts table)
                                          ↓
                                    OpenRouter AI Gateway
                                    (embeddings, metadata extraction, vision)

pg_cron @ 11:00 UTC → cerebro-graph-ingest → Microsoft Graph (app-only)
                       (mail/calendar/OneNote/files; AI gatekeeper)
                       → thoughts table (metadata.source = graph-*)

MCP Clients → Cloudflare Worker (mcp.yourdomain.com) → Edge Functions
              (OAuth discovery, DCR stub, authorize/token proxy)
              Routes: /rw/* → primary server, /* → read-only server
```

- **Primary MCP:** 12 tools (7 core + 5 publishing), dual auth (OAuth Bearer + `x-brain-key` header)
- **Read-Only MCP:** 3 tools, OAuth only (Entra ID JWKS validation)
- **Cloudflare Worker:** Serves RFC 9728 metadata, strips `resource` param and rewrites `scope` from `api://` to GUID format for Entra compatibility, path-specific protected resource metadata for VS Code compatibility
- **Graph Ingest:** Reuses existing `GRAPH_*` secrets; cron at 11:00 UTC (1 hr before daily digest at 12:00 UTC); see [docs/12-graph-ingest-setup.md](docs/12-graph-ingest-setup.md)

## Repo Layout

```text
integrations/       — Edge Functions (mcp-server, mcp-server-readonly, cloudflare-worker,
                      teams-capture, discord-capture, alexa-capture, imessage-capture,
                      daily-digest, cerebro-graph-ingest)
schemas/core/       — SQL migrations (schema.sql, 002–012), numbered sequentially
docs/               — Setup guides (01–12)
scripts/dbsql.py    — Pure-Python PostgreSQL client (bypasses libpq SCRAM issue)
```

## Guard Rails

- **Protect the `thoughts` table schema.** Add columns freely, but never alter, rename, or drop existing ones.
- **Destructive SQL is off-limits.** No `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, or unqualified `DELETE FROM`.
- **Keep secrets out of source.** All credentials go into Supabase Secrets, never committed files. This includes `GRAPH_USER_ID` — never commit real UPNs or object IDs.
- **All server functions deploy as Supabase Edge Functions.** No local servers, stdio transports, or `claude_desktop_config.json` setups.
- **No large binary files** (over 1 MB) in the repo.

## Critical Patterns & Gotchas

- **Edge Function routes must use `app.post("*")`** not `app.post("/")` — Supabase strips paths during routing and the wildcard is required.
- **Deploy directory needs actual file copies**, not symlinks. Always `cp` both `index.ts` and `deno.json` to `supabase/functions/<name>/` before deploying.
- **Migrations must be idempotent** — use `IF NOT EXISTS` / `IF EXISTS` in all SQL files. Name them `NNN-description.sql` sequentially.
- **psql cannot connect** to this Supabase instance (libpq SCRAM-SHA-256 incompatibility with Supavisor). Always use the Supabase CLI or `scripts/dbsql.py`.
- **All Edge Functions** follow the same pattern: Deno + Hono, imports from JSR/npm specifiers, `Deno.serve(app.fetch)`.
- **iMessage loop prevention:** Bot replies use zero-width space prefix; stale messages (>5 min) are ignored; `source_message_id` deduplicates.

## Related Projects

- **[cerebro-onprem](https://github.com/asudbring/cerebro-onprem)** — Fully self-hosted version using Docker + Ollama for local AI
