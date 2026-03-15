<h1 align="center">Cerebro</h1>

<p align="center"><em>A cloud brain for storing thoughts — built for AI tools.</em></p>

---

One database, one AI gateway, one MCP server. Any AI you use can plug in. No middleware, no SaaS chains, no Zapier.

Cerebro is a persistent memory layer for your AI tools. It stores your thoughts with vector embeddings and structured metadata in a Supabase database, then exposes them via MCP so that Claude, ChatGPT, Cursor, Claude Code, or whatever ships next month can all search and write to the same brain.

Based on the [Open Brain](https://github.com/NateBJones/OB1) architecture by Nate B. Jones.

## How It Works

**When you capture a thought:** Your AI client sends text to the `capture_thought` MCP tool → the server generates a 1536-dimensional embedding AND extracts metadata (topics, people, action items, type) in parallel → both get stored as a single row in Supabase → confirmation returned.

**When you search:** Your AI sends the query → the server embeds it → Supabase matches against every stored thought by vector similarity → results come back ranked by meaning, not keywords.

## Getting Started

**[→ Setup Guide](docs/01-getting-started.md)** — Build the full system (database, AI gateway, MCP server) in about 30 minutes.

### What You Need

| Service | Purpose | Cost |
| ------- | ------- | ---- |
| [Supabase](https://supabase.com) | Database + Edge Functions | Free tier |
| [OpenRouter](https://openrouter.ai) | Embeddings + metadata extraction | ~$0.10–0.30/month |

### What Gets Built

- **PostgreSQL + pgvector** database with semantic search
- **MCP server** (Supabase Edge Function) with 4 tools:
  - `search_thoughts` — Semantic similarity search
  - `list_thoughts` — Browse recent with filters
  - `thought_stats` — Summary statistics
  - `capture_thought` — Save with auto-embedding + metadata extraction
- **Access key auth** — Simple, secure, no OAuth complexity

## Capture Sources

| Source | How | Guide |
| ------ | --- | ----- |
| **Any MCP client** | Direct tool calls via MCP server | [Getting Started](docs/01-getting-started.md) |
| **Microsoft Teams** | DM or @mention the Cerebro bot | [Teams Setup](docs/02-teams-capture-setup.md) |
| **Discord** | `/capture` and `/search` slash commands | [Discord Setup](docs/03-discord-capture-setup.md) |
| **Alexa** | "Alexa, tell cerebro …" voice commands | [Alexa Setup](docs/04-alexa-setup.md) |

## Features

### Daily & Weekly Digest

Automated AI-powered summaries delivered to Teams and Discord. The **daily digest** (every morning) covers key themes, action items, people, and upcoming reminders. The **weekly digest** (Sundays) provides a deeper analysis of recurring patterns, goal progress, completed tasks, and relationship touchpoints. Channels auto-register on first capture.

**[→ Digest Setup](docs/06-daily-digest-setup.md)**

Also available on-demand via Alexa: "ask cerebro for my daily digest" / "ask cerebro for my weekly digest"

### Calendar Reminders

When you mention a date or time in a captured thought, Cerebro automatically creates a calendar event on O365 and/or Google Calendar. Works from any capture source.

**[→ Reminders Setup](docs/05-reminders-setup.md)**

Example: "remind me to call the dentist next Wednesday at 5 AM" → creates a calendar event for Wed 5:00 AM.

## Project Structure

```
docs/           — Setup guides and documentation
extensions/     — Feature extensions (coming soon)
integrations/   — MCP server, Teams capture, Discord capture, Alexa voice, daily digest
schemas/        — Database schemas and migrations
```

## Connecting Your AI

Works with any MCP-compatible client:

| Client | Connection Method |
| ------ | ----------------- |
| Claude Desktop | Settings → Connectors → Add custom connector → paste URL |
| ChatGPT | Settings → Apps & Connectors → Create → paste URL |
| Claude Code | `claude mcp add --transport http cerebro <url> --header "x-brain-key: <key>"` |
| Cursor/VS Code | Remote MCP URL or `mcp-remote` bridge |

## License

[FSL-1.1-MIT](LICENSE.md) — Based on Open Brain by Nate B. Jones.
