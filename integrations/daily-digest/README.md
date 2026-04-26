# Daily & Weekly Digest

Automated daily and weekly summaries of your captured thoughts, delivered to Teams and Discord channels.

## How It Works

1. **pg_cron** triggers the Edge Function on a schedule (daily at 6 AM Central, weekly on Sunday noon)
2. **Data collection** — queries thoughts, completed tasks, and upcoming reminders in parallel
3. **LLM summarization** — sends structured data to OpenRouter (GPT-4o-mini) with tailored prompts
4. **Delivery** — posts the digest to all registered Teams conversations and Discord channels

Channels are auto-registered on first capture — no manual setup required.

## Daily vs Weekly

| Aspect | Daily | Weekly |
| ------ | ----- | ------ |
| **Schedule** | Every day 6 AM Central | Sundays 12 PM Central |
| **Lookback** | 24 hours | 7 days |
| **Reminder window** | 48 hours ahead | 7 days ahead |
| **Focus** | Themes, actions, people, reminders | Recurring patterns, goal progress, trends, stats |
| **Length** | 200-400 words | 400-600 words |
| **Data** | Thoughts + reminders | Thoughts + completed tasks + reminders + aggregate stats |

## Digest Content

The AI-generated summary includes:

### Daily

- **Action Items** (top of digest) — deduplicated `metadata.action_items[]` across every bucket below, case-insensitive
- 📧 **Important Emails** — items with `metadata.source = graph-mail` (link label: `[Open in Outlook]`)
- 📅 **Calendar** — items with `metadata.source = graph-event` (link label: `[Open in Calendar]`)
- 📝 **OneNote** — items with `metadata.source = graph-onenote` (link label: `[Open in OneNote]`)
- 📄 **Documents** — items with `metadata.source = graph-file` (link label: `[Open document]`)
- **Captured** — everything else (manual MCP/Teams/Discord/Alexa/iMessage captures)
- Key themes and decisions made
- People mentioned and follow-ups needed
- Upcoming reminders (next 48 hours)
- Insights and things learned

### Weekly (additional analysis)

- Stats line prepended: `Sources: N captured, N emails, N meetings, N notes, N documents`
- Recurring themes and emerging patterns
- Progress on goals — completed tasks vs open items
- People and relationship touchpoints across the week
- Key decisions and their context
- Week stats: type breakdown, source breakdown, busiest day
- Forward-looking observations for the week ahead

The empty-state guard checks all 5 buckets — the digest is suppressed only when every bucket is empty.

## Source Buckets

Items are bucketed by `metadata.source`:

| Source value | Bucket |
|--------------|--------|
| `graph-mail` | 📧 Important Emails |
| `graph-event` | 📅 Calendar |
| `graph-onenote` | 📝 OneNote |
| `graph-file` | 📄 Documents |
| anything else (`mcp`, `teams`, `discord`, `alexa`, `imessage`) | Captured |

Graph-tagged rows are populated by the [`cerebro-graph-ingest`](../cerebro-graph-ingest/README.md) function.

## Environment Variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `SUPABASE_URL` | Yes | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Auto-set by Supabase |
| `OPENROUTER_API_KEY` | Yes | For LLM summarization |
| `TEAMS_BOT_APP_ID` | For Teams | Bot Framework app ID |
| `TEAMS_BOT_APP_SECRET` | For Teams | Bot Framework app secret |
| `DISCORD_BOT_TOKEN` | For Discord | Discord bot token |
| `RESEND_API_KEY` | For email | Resend API key ([free tier: 100/day](https://resend.com)) |
| `DIGEST_EMAIL_TO` | For email | Recipient address(es), comma-separated |
| `DIGEST_EMAIL_FROM` | For email | Sender address (default: `Cerebro <onboarding@resend.dev>`) |

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/` | Generate and deliver digest (used by pg_cron). Body: `{"period":"daily"}` or `{"period":"weekly"}` |
| `GET` | `/?generate=true` | On-demand digest generation and delivery |
| `GET` | `/` | Health check |

## Delivery Channels

| Channel | How | Requirements |
| ------- | --- | ------------ |
| **Teams** | Bot Framework proactive message | `TEAMS_BOT_APP_ID` + `TEAMS_BOT_APP_SECRET` |
| **Discord** | Bot REST API post to channel | `DISCORD_BOT_TOKEN` |
| **Email** | Resend HTML email | `RESEND_API_KEY` + `DIGEST_EMAIL_TO` |
| **Alexa** | On-demand voice query | No config — just ask |

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
> "Alexa, ask cerebro for my weekly digest"

These return spoken summaries directly from the database (daily = last 24h, weekly = last 7 days).

## Setup

See **[Daily Digest Setup Guide](../../docs/06-daily-digest-setup.md)** for full deployment instructions.
