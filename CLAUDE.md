# CLAUDE.md — Agent Instructions for Cerebro

This file tells AI coding tools (Claude Code, Codex, Cursor, etc.) how to navigate and contribute to this repo safely.

> **See also:** `AGENTS.md` for comprehensive agent instructions including architecture details, infrastructure, known issues, and integration-specific notes. **When making changes to the project, update both CLAUDE.md, AGENTS.md, and any relevant docs/ files to keep documentation in sync.**

## What This Repo Is

Cerebro is a personal knowledge store that lives in the cloud. It pairs a Supabase PostgreSQL database (with pgvector for embeddings) with an MCP server so that any compatible AI client can capture, search, and manage your thoughts. Multiple input channels — Discord, Teams, Alexa, iMessage, and direct MCP calls — all write to the same underlying data.

Inspired by the [Open Brain](https://github.com/NateBJones/OB1) project by Nate B. Jones.

**License:** FSL-1.1-MIT. No commercial derivative works for the first 2 years.

## Repo Structure

```
docs/           — Setup guides and documentation
extensions/     — Feature extensions that build on the core system
integrations/   — MCP server, capture sources, webhook receivers
schemas/        — Database schemas (core thoughts table + extensions)
.github/        — CI workflows and configs
```

## Core Architecture

- **Database:** Supabase (PostgreSQL + pgvector) — `thoughts` table with 1536-dim embeddings
- **AI Gateway:** OpenRouter — embeddings via `text-embedding-3-small`, metadata extraction via `gpt-4o-mini`, PDF/document analysis via `gemini-2.0-flash`, image vision via `gpt-4o-mini`
- **MCP Server:** Supabase Edge Function (Deno + Hono) with 7 tools: `search_thoughts`, `list_thoughts`, `thought_stats`, `capture_thought`, `complete_task`, `reopen_task`, `delete_task`
- **iMessage Capture:** BlueBubbles on Mac server + Cloudflare named tunnel → Supabase Edge Function
- **Auth:** Access key via `x-brain-key` header or `?key=` query param

## Guard Rails

- **Protect the `thoughts` table schema.** New columns are fine, but do not alter, rename, or drop existing ones — every integration depends on the current structure.
- **Keep secrets out of source.** All credentials and API keys go into Supabase Secrets (environment variables), never into committed files.
- **No large binary files** (over 1 MB) in the repo.
- **Destructive SQL is off-limits.** No `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, or unqualified `DELETE FROM` in any SQL file.
- **All server functions deploy as Supabase Edge Functions.** Do not introduce local servers, stdio transports, or `claude_desktop_config.json`-based setups.

## Key Files

- `schemas/core/schema.sql` — Core database schema (thoughts table, vector search, RLS)
- `schemas/core/002-digest-channels.sql` — Digest channels table migration
- `schemas/core/003-digest-cron.sql` — pg_cron scheduling for daily/weekly digests
- `schemas/core/004-add-file-columns.sql` — File attachment columns (file_url, file_type)
- `integrations/mcp-server/index.ts` — Core MCP Edge Function
- `integrations/teams-capture/index.ts` — Microsoft Teams capture bot (Bot Framework)
- `integrations/discord-capture/index.ts` — Discord capture bot (slash commands)
- `integrations/alexa-capture/index.ts` — Alexa voice skill (HTTPS endpoint)
- `integrations/daily-digest/index.ts` — Daily/weekly digest generator + delivery
- `docs/01-getting-started.md` — Full setup guide
- `docs/02-teams-capture-setup.md` — Teams integration setup
- `docs/03-discord-capture-setup.md` — Discord integration setup
- `docs/04-alexa-setup.md` — Alexa voice setup
- `docs/05-reminders-setup.md` — Calendar reminders setup (O365 + Google)
- `docs/06-daily-digest-setup.md` — Daily digest setup (scheduling + delivery)
- `docs/07-file-attachments-setup.md` — File attachment setup (vision + storage)
- `schemas/core/005-add-status-column.sql` — Task status column and indexes
- `docs/08-task-management-setup.md` — Task management setup guide
- `docs/09-ai-guided-setup.md` — AI coding tool deployment workflow
- `integrations/imessage-capture/index.ts` — iMessage capture via BlueBubbles (text commands, file attachments)
- `schemas/core/006-imessage-digest.sql` — iMessage digest channel migration
- `docs/10-imessage-setup.md` — iMessage/BlueBubbles setup guide
- `LICENSE.md` — FSL-1.1-MIT terms
