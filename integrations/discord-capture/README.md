# Discord Capture

A Supabase Edge Function that connects Discord to Cerebro via slash commands. Use `/capture` to save thoughts and `/search` to find them — from any device.

## How It Works

```
/capture thought → Discord → Edge Function → embed + extract metadata → Supabase → reply
/search query    → Discord → Edge Function → embed query → vector search → reply with results
```

Uses Discord's HTTP Interactions Endpoint (no WebSocket gateway needed), making it a perfect fit for serverless Edge Functions.

## Commands

| Command | Description |
| ------- | ----------- |
| `/capture thought:<text>` | Save a thought with auto-embedding and metadata extraction |
| `/search query:<text>` | Semantic search across your stored thoughts |

## Prerequisites

- Working Cerebro setup (database + OpenRouter key)
- Discord account (free)

## Environment Variables

Set via `supabase secrets set`:

| Variable | Source | Description |
| -------- | ------ | ----------- |
| `SUPABASE_URL` | Auto-provided | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided | Service role key |
| `OPENROUTER_API_KEY` | You set this | OpenRouter API key |
| `DISCORD_PUBLIC_KEY` | Discord Developer Portal | Application public key (for signature verification) |
| `DISCORD_BOT_TOKEN` | Discord Developer Portal | Bot token (for registering slash commands) |

## Metadata

Captured thoughts include Discord-specific metadata:

```json
{
  "type": "idea",
  "topics": ["architecture", "design"],
  "people": [],
  "action_items": [],
  "source": "discord",
  "discord_sender": "username"
}
```

## Setup

See **[Discord Capture Setup Guide](../../docs/03-discord-capture-setup.md)** for step-by-step instructions.
