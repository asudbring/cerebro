# Daily Digest

Automated daily and weekly summaries of your captured thoughts, delivered to Teams and Discord channels.

## How It Works

1. **pg_cron** triggers the Edge Function on a schedule (daily at 6 AM Central, weekly on Sunday)
2. **Data collection** — queries yesterday's thoughts, completed tasks, and upcoming reminders in parallel
3. **LLM summarization** — sends structured data to OpenRouter (GPT-4o-mini) with tailored prompts
4. **Delivery** — posts the digest to all registered Teams conversations and Discord channels

Channels are auto-registered on first capture — no manual setup required.

## Digest Content

The AI-generated summary includes:

- **Key themes** and decisions made
- **Action items** — open and completed
- **People** mentioned and follow-ups needed
- **Upcoming reminders** (next 48 hours)
- **Insights** and things learned

## Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `SUPABASE_URL` | Yes | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Auto-set by Supabase |
| `OPENROUTER_API_KEY` | Yes | For LLM summarization |
| `TEAMS_BOT_APP_ID` | For Teams | Bot Framework app ID |
| `TEAMS_BOT_APP_SECRET` | For Teams | Bot Framework app secret |
| `DISCORD_BOT_TOKEN` | For Discord | Discord bot token |

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/` | Generate and deliver digest (used by pg_cron). Body: `{"period":"daily"}` or `{"period":"weekly"}` |
| `GET` | `/?generate=true` | On-demand digest generation and delivery |
| `GET` | `/` | Health check |

## Database Tables

### `digest_channels`

Auto-populated when users first capture a thought from Teams or Discord.

```sql
-- View registered channels
select source, teams_user_name, discord_channel_id, enabled, last_digest_at
from digest_channels;
```

### Cron Jobs

Managed via `pg_cron` — see [`schemas/core/003-digest-cron.sql`](../../schemas/core/003-digest-cron.sql).

## Alexa

Alexa can't receive push notifications. Instead, users ask on-demand:

> "Alexa, ask cerebro for my daily digest"

This returns a spoken summary of the last 24 hours directly from the database.

## Setup

See **[Daily Digest Setup Guide](../../docs/06-daily-digest-setup.md)** for full deployment instructions.
