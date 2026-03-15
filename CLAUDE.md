# CLAUDE.md — Agent Instructions for Cerebro

This file helps AI coding tools (Claude Code, Codex, Cursor, etc.) work effectively in this repo.

## What This Repo Is

Cerebro is a persistent AI memory system — one database (Supabase + pgvector), one MCP protocol, any AI client. It stores thoughts with vector embeddings and structured metadata, enabling semantic search across everything you capture. Any AI tool that supports MCP can read from and write to your brain.

Based on the [Open Brain](https://github.com/NateBJones/OB1) architecture by Nate B. Jones.

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
- **AI Gateway:** OpenRouter — embeddings via `text-embedding-3-small`, metadata extraction via `gpt-4o-mini`
- **MCP Server:** Supabase Edge Function (Deno + Hono) with 4 tools: `search_thoughts`, `list_thoughts`, `thought_stats`, `capture_thought`
- **Auth:** Access key via `x-brain-key` header or `?key=` query param

## Guard Rails

- **Never modify the core `thoughts` table structure.** Adding columns is fine; altering or dropping existing ones is not.
- **No credentials, API keys, or secrets in any file.** Use environment variables via Supabase Secrets.
- **No binary blobs** over 1MB.
- **No `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, or unqualified `DELETE FROM`** in SQL files.
- **MCP servers must be remote (Supabase Edge Functions), not local.** Never use `claude_desktop_config.json`, `StdioServerTransport`, or local Node.js servers.

## Key Files

- `schemas/core/schema.sql` — Core database schema (thoughts table, vector search, RLS)
- `integrations/mcp-server/index.ts` — Core MCP Edge Function
- `integrations/teams-capture/index.ts` — Microsoft Teams capture bot (Bot Framework)
- `integrations/discord-capture/index.ts` — Discord capture bot (slash commands)
- `docs/01-getting-started.md` — Full setup guide
- `docs/02-teams-capture-setup.md` — Teams integration setup
- `docs/03-discord-capture-setup.md` — Discord integration setup
- `LICENSE.md` — FSL-1.1-MIT terms
