<p align="center">
  <img src=".github/cerebro-logo.jpg" alt="Cerebro" width="300">
</p>

<h1 align="center">Cerebro</h1>

<p align="center"><em>Your personal knowledge brain in the cloud — capture from anywhere, search by meaning.</em></p>

---

Cerebro gives you a single place to store every fleeting thought, decision, and reminder — then find it again by asking what it *meant*, not what words you used. It runs on Supabase (free tier), talks to your AI tools over MCP, and accepts input from Discord, Teams, Alexa, or any MCP client.

The stack is deliberately simple: a PostgreSQL database with vector search, an AI gateway for embeddings, and Edge Functions for each integration. No middleware layers, no paid connectors, no glue services.

Inspired by the [Open Brain](https://github.com/NateBJones/OB1) project by Nate B. Jones.

## How It Works

**Capturing:** You send a thought from any source (chat message, voice command, AI tool). Cerebro generates a vector embedding and extracts structured metadata (topics, people, action items, type) in parallel, then stores everything as a single row.

**Searching:** You describe what you're looking for in plain language. Cerebro embeds your query and runs a cosine similarity search across all stored thoughts — so "career decisions" finds a note about "Sarah thinking about leaving her job" even with zero overlapping words.

## Getting Started

**[→ Complete Setup Guide](docs/SETUP.md)** — Start here. Walks you through everything from core infrastructure to optional features, with verification tests at every step.

The setup guide covers:
1. **Core Infrastructure** — Supabase + OpenRouter + MCP server (~20 min)
2. **Capture Sources** — Discord, Teams, and/or Alexa
3. **Calendar Reminders** — Auto-create O365/Google events from dates in thoughts
4. **Daily & Weekly Digest** — AI summaries to chat channels + email
5. **File Attachments** — AI vision scanning of images, PDFs, and documents
6. **Task Management** — Complete, reopen, and delete tasks with natural language

> **Quick links:** [Core Setup](docs/01-getting-started.md) · [Discord](docs/03-discord-capture-setup.md) · [Teams](docs/02-teams-capture-setup.md) · [Alexa](docs/04-alexa-setup.md) · [Reminders](docs/05-reminders-setup.md) · [Digest](docs/06-daily-digest-setup.md) · [File Attachments](docs/07-file-attachments-setup.md) · [Task Management](docs/08-task-management-setup.md)
>
> **🤖 Using an AI coding tool?** [AI-Guided Setup](docs/09-ai-guided-setup.md) — Let your AI walk you through the deployment step by step.

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
- **Supabase Storage** — File attachments with signed URLs (1 GB free)
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

Automated AI-powered summaries delivered to Teams, Discord, and email. The **daily digest** (every morning) covers key themes, action items, people, and upcoming reminders. The **weekly digest** (Sundays) provides a deeper analysis of recurring patterns, goal progress, completed tasks, and relationship touchpoints. Chat channels auto-register on first capture; email uses [Resend](https://resend.com) (free tier: 100/day).

**[→ Digest Setup](docs/06-daily-digest-setup.md)**

Also available on-demand via Alexa: "ask cerebro for my daily digest" / "ask cerebro for my weekly digest"

### Calendar Reminders

When you mention a date or time in a captured thought, Cerebro automatically creates a calendar event on O365 and/or Google Calendar. Works from any capture source.

**[→ Reminders Setup](docs/05-reminders-setup.md)**

Example: "remind me to call the dentist next Wednesday at 5 AM" → creates a calendar event for Wed 5:00 AM.

### File Attachments

Send images, PDFs, and documents to any capture channel. Cerebro uses AI vision
to scan and extract content, then optionally stores the file in Supabase Storage.

- 📷 Image OCR and description via GPT-4o-mini vision
- 📄 PDF and document analysis via Gemini 2.0 Flash
- 💾 Optional file storage (1 GB free on Supabase)
- 🔍 Search and filter thoughts by file attachment

**[→ File Attachments Setup](docs/07-file-attachments-setup.md)**

### Task Management

Track task lifecycle with natural language. Complete, reopen, and delete tasks
by describing them — Cerebro uses AI to match the right one.

- ✅ Complete tasks: "done: quarterly report"
- 🔄 Reopen tasks: "reopen: quarterly report"
- 🗑️ Soft-delete thoughts: "delete: old reminder"
- 🔍 Filter by status in MCP tools (open/done/deleted)

**[→ Task Management Setup](docs/08-task-management-setup.md)**

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
