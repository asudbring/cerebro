# MCP Server

The core Cerebro MCP server — a Supabase Edge Function that gives any MCP-compatible AI client read/write access to your brain.

## Tools

| Tool | Description |
| ---- | ----------- |
| `search_thoughts` | Semantic similarity search — finds thoughts by meaning, not keywords |
| `list_thoughts` | Browse recent thoughts with optional filters (type, topic, person, days) |
| `thought_stats` | Summary statistics — totals, types, top topics, people mentioned |
| `capture_thought` | Save a new thought with auto-generated embedding and metadata |

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

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-mcp?key=your-access-key
```
