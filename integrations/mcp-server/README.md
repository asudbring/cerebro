# MCP Server

The core Cerebro MCP server — a Supabase Edge Function that gives any MCP-compatible AI client read/write access to your brain.

## Tools

### Core Tools

| Tool | Description |
| ---- | ----------- |
| `search_thoughts` | Semantic similarity search — finds thoughts by meaning, not keywords |
| `list_thoughts` | Browse recent thoughts with optional filters (type, topic, person, days) |
| `thought_stats` | Summary statistics — totals, types, top topics, people mentioned |
| `capture_thought` | Save a new thought with auto-generated embedding and metadata |
| `complete_task` | Mark a task as done by semantic match |
| `reopen_task` | Reopen a completed task |
| `delete_task` | Soft-delete a thought or task |

### Publishing Tools

| Tool | Description |
| ---- | ----------- |
| `search_series_bible` | Search fiction series bibles — characters, worldbuilding, timeline, settings, plot arcs |
| `search_style_guide` | Search author style guides — voice, word lists, formatting, genre conventions |
| `search_editorial_history` | Search past editorial findings across pipeline runs |
| `search_cover_specs` | Search book cover design specifications |
| `capture_publishing` | Write content into any publishing collection (series_bible, style_guide, editorial_history, cover_specs) |

## Features

- **Calendar reminders** — When a captured thought mentions a future date/time, automatically creates events on O365 and/or Google Calendar. See [Reminders Setup](../../docs/05-reminders-setup.md).

## Stack

- **Runtime:** Deno (Supabase Edge Functions)
- **Framework:** [Hono](https://hono.dev/) web framework
- **MCP Transport:** `@hono/mcp` StreamableHTTPTransport
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Database:** Supabase client (`@supabase/supabase-js`)
- **Validation:** Zod

## Environment Variables

Set via `supabase secrets set`:

| Variable | Source | Description |
| -------- | ------ | ----------- |
| `SUPABASE_URL` | Auto-provided | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided | Service role key for full DB access |
| `OPENROUTER_API_KEY` | You set this | OpenRouter API key for embeddings + LLM |
| `MCP_ACCESS_KEY` | You set this | Access key for authenticating MCP requests |

### Optional (Calendar Reminders)

| Variable | Source | Description |
| -------- | ------ | ----------- |
| `GRAPH_TENANT_ID` | Azure portal | Entra ID tenant ID (for O365 calendar) |
| `GRAPH_CLIENT_ID` | Azure portal | Entra ID app client ID |
| `GRAPH_CLIENT_SECRET` | Azure portal | Entra ID app client secret |
| `CALENDAR_USER_EMAIL` | You set this | O365 mailbox for calendar events |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Cloud | Service account JSON key (for Google Calendar) |
| `GOOGLE_CALENDAR_ID` | Google Calendar | Target calendar ID |

See **[Reminders Setup](../../docs/05-reminders-setup.md)** for details.

## Deployment

```bash
# From your Supabase project directory
supabase functions deploy cerebro-mcp --no-verify-jwt
```

## Authentication

Every request must include a valid access key via one of:

- **Header:** `x-brain-key: your-access-key`
- **Query parameter:** `?key=your-access-key`

## Connection URL

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp?key=your-access-key
```
