# Teams Capture

A Supabase Edge Function that connects Microsoft Teams to Cerebro. Message the bot in a 1:1 DM or @mention it in a channel — your thought gets captured with embeddings and metadata automatically.

## How It Works

```
Teams message → Azure Bot Service → Edge Function → embed + extract metadata → Supabase → reply in Teams
```

1. You send a message to the Cerebro bot in Teams (DM or @mention in channel)
2. Azure Bot Service routes the message to the Edge Function
3. The function validates the Bot Framework JWT token
4. Embedding (1536-dim vector) and metadata extraction run in parallel via OpenRouter
5. The thought is stored in the `thoughts` table with `source: "teams"`
6. A confirmation reply appears in the conversation

## Prerequisites

- Working Cerebro setup (database + OpenRouter key)
- Microsoft 365 tenant with Teams
- Azure subscription (Bot Channels Registration is free for Teams)

## Environment Variables

Set via `supabase secrets set`:

| Variable | Source | Description |
| -------- | ------ | ----------- |
| `SUPABASE_URL` | Auto-provided | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided | Service role key |
| `OPENROUTER_API_KEY` | You set this | OpenRouter API key |
| `TEAMS_BOT_APP_ID` | Entra ID app registration | Application (client) ID |
| `TEAMS_BOT_APP_SECRET` | Entra ID app registration | Client secret value |

## Metadata

Captured thoughts include Teams-specific metadata:

```json
{
  "type": "idea",
  "topics": ["project-planning", "architecture"],
  "people": ["Sarah"],
  "action_items": [],
  "source": "teams",
  "teams_sender": "Allen Sudbring",
  "teams_conversation_id": "..."
}
```

## Setup

See **[Teams Capture Setup Guide](../../docs/02-teams-capture-setup.md)** for step-by-step instructions.
