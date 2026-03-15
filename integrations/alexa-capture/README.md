# Alexa Voice Capture & Query

Supabase Edge Function that serves as the HTTPS endpoint for the Cerebro Alexa Custom Skill. Handles voice capture, semantic search, stats, browsing, and task management — all without Lambda or Zapier middleware.

## Invocation

- **"Alexa, tell cerebro …"** — for capture, task complete, task reopen
- **"Alexa, ask cerebro …"** — for search, stats, browse recent

## Intents

| Intent | Example | Action |
| ------ | ------- | ------ |
| `CaptureThoughtIntent` | "tell cerebro remember buy groceries" | Embed + extract metadata → insert into thoughts |
| `SearchIntent` | "ask cerebro about deployment decisions" | Vector search → speak top results |
| `StatsIntent` | "ask cerebro for stats" | Count thoughts, top types, newest date |
| `BrowseRecentIntent` | "ask cerebro what's recent" | Last 5 thoughts (optionally filtered by type) |
| `CompleteTaskIntent` | "tell cerebro done buy groceries" | Find matching open task → mark done |
| `ReopenTaskIntent` | "tell cerebro reopen buy groceries" | Find matching done task → reopen |

## Security

- Alexa request signature verification (X.509 cert chain + SHA-1 RSA)
- Timestamp validation (150-second tolerance)
- Optional skill ID verification (`ALEXA_SKILL_ID` env var)
- Set `ALEXA_SKIP_VERIFICATION=true` during development only

## Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `SUPABASE_URL` | Yes | Supabase project URL (auto-set) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (auto-set) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for embeddings + metadata |
| `ALEXA_SKILL_ID` | No | Verify requests come from your skill only |
| `ALEXA_SKIP_VERIFICATION` | No | Set `true` to skip signature verification in dev |
