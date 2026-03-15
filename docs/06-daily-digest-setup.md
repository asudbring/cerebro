# Daily & Weekly Digest Setup

Cerebro's digest system automatically summarizes your captured thoughts and delivers them to your Teams and Discord channels. The **daily digest** runs every morning with a concise summary, while the **weekly digest** runs Sundays with a deeper analysis of recurring themes, goal progress, and patterns.

## How It Works

```
pg_cron (daily at 6 AM Central)
  → pg_net HTTP POST
    → cerebro-digest Edge Function
      → Query yesterday's thoughts + upcoming reminders
      → OpenRouter LLM summarization
      → Deliver to Teams (Bot Framework) + Discord (REST API)
```

Channels are **auto-registered** — the first time you capture a thought from Teams or Discord, that conversation/channel is automatically enrolled for digest delivery.

**Alexa** doesn't support push notifications, but you can ask on-demand:
> "Alexa, ask cerebro for my daily digest"
> "Alexa, ask cerebro for my weekly digest"

---

## What's in Each Digest

### Daily Digest (every morning)
- Key themes and decisions
- Action items (open and completed)
- People mentioned and follow-ups needed
- Reminders coming up in the next 48 hours
- Interesting insights or things learned
- **Target: 200-400 words**

### Weekly Digest (Sundays)
- Recurring themes and emerging patterns
- Progress on goals and projects (completed vs open)
- People and relationship touchpoints across the week
- Key decisions made and their context
- Open items and attention needed for next week
- Week stats: type breakdown, source breakdown, busiest day
- **Target: 400-600 words**

---

## Prerequisites

- Cerebro Supabase project with the core schema deployed
- At least one capture source configured (Teams, Discord, or MCP)
- `OPENROUTER_API_KEY` set in Edge Function secrets

## Credential Tracker

```text
DAILY DIGEST -- CREDENTIAL TRACKER
--------------------------------------

SUPABASE
  Project Ref:         ____________ <- Dashboard URL
  Edge Function URL:   ____________ <- After deploy

TEAMS (if using Teams delivery)
  BOT_APP_ID:          ____________ <- From Teams setup
  BOT_APP_SECRET:      ____________ <- From Teams setup

DISCORD (if using Discord delivery)
  BOT_TOKEN:           ____________ <- From Discord setup

--------------------------------------
```

---

## Step 1: Run Database Migrations

### 1a. Create the `digest_channels` table

In the Supabase SQL Editor, run the contents of [`schemas/core/002-digest-channels.sql`](../schemas/core/002-digest-channels.sql):

```sql
-- Creates the digest_channels table for tracking delivery targets
-- See the file for full SQL
```

This table is auto-populated when users first capture thoughts from Teams or Discord.

### 1b. Enable pg_cron and pg_net extensions

In your Supabase Dashboard:

1. Go to **Database** → **Extensions**
2. Search for **pg_cron** → click **Enable**
3. Search for **pg_net** → click **Enable**

### 1c. Schedule the digest cron jobs

In the Supabase SQL Editor, run the contents of [`schemas/core/003-digest-cron.sql`](../schemas/core/003-digest-cron.sql).

> **Important:** The SQL uses `current_setting('app.settings.supabase_url')` and `current_setting('app.settings.service_role_key')` which are automatically available in Supabase. If they aren't set in your project, replace them with literal values:

```sql
-- Alternative with literal values
select cron.schedule(
  'cerebro-daily-digest',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/cerebro-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{"period":"daily"}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
```

**Cron schedule reference:**

| Job | Cron Expression | Time (UTC) | Time (Central) |
| --- | --------------- | ---------- | -------------- |
| Daily digest | `0 12 * * *` | 12:00 PM | 6:00 AM |
| Weekly digest | `0 18 * * 0` | 6:00 PM Sunday | 12:00 PM Sunday |

To change the time, update the cron expression. Use [crontab.guru](https://crontab.guru) for help.

---

## Step 2: Deploy the Edge Function

### Set Environment Variables

The digest function reuses credentials from your existing capture integrations:

```bash
# Already set if you configured Teams capture
supabase secrets set TEAMS_BOT_APP_ID=your-bot-app-id
supabase secrets set TEAMS_BOT_APP_SECRET=your-bot-app-secret

# Already set if you configured Discord capture
supabase secrets set DISCORD_BOT_TOKEN=your-bot-token

# Already set from initial setup
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-your-key
```

> You only need to set credentials for the channels you want to deliver to. If you only use Teams, you don't need the Discord token, and vice versa.

### Create and Deploy

```bash
supabase functions new cerebro-digest
```

Copy the contents of [`integrations/daily-digest/deno.json`](../integrations/daily-digest/deno.json) into `supabase/functions/cerebro-digest/deno.json`.

Copy the contents of [`integrations/daily-digest/index.ts`](../integrations/daily-digest/index.ts) into `supabase/functions/cerebro-digest/index.ts`.

Deploy:

```bash
supabase functions deploy cerebro-digest --no-verify-jwt
```

> `--no-verify-jwt` is required because pg_cron calls the function without a JWT.

---

## Step 3: Test the Digest

### Manual trigger via curl

```bash
# Generate and deliver a daily digest
curl -X POST \
  https://YOUR-PROJECT-REF.supabase.co/functions/v1/cerebro-digest \
  -H "Content-Type: application/json" \
  -d '{"period":"daily"}'

# Generate a weekly digest
curl -X POST \
  https://YOUR-PROJECT-REF.supabase.co/functions/v1/cerebro-digest \
  -H "Content-Type: application/json" \
  -d '{"period":"weekly"}'

# On-demand via GET (doesn't deliver — just returns the digest)
curl "https://YOUR-PROJECT-REF.supabase.co/functions/v1/cerebro-digest?generate=true"
```

### Verify channel registration

After capturing at least one thought from Teams or Discord, check the `digest_channels` table:

```sql
select * from digest_channels;
```

You should see rows for each Teams conversation and Discord channel you've used.

### Via Alexa

> "Alexa, ask cerebro for my daily digest"

This returns a spoken summary of the last 24 hours — separate from the scheduled push to Teams/Discord.

---

## Step 4: Manage Digest Channels

### View registered channels

```sql
select source, teams_user_name, discord_channel_id, enabled, last_digest_at
from digest_channels
order by created_at desc;
```

### Disable a channel

```sql
update digest_channels set enabled = false
where discord_channel_id = '123456789';
```

### Re-enable a channel

```sql
update digest_channels set enabled = true
where teams_conversation_id = 'your-conversation-id';
```

### Delete a channel

```sql
delete from digest_channels where id = 'channel-uuid';
```

---

## Step 5: Monitor & Troubleshoot

### Check cron job status

```sql
select * from cron.job;
```

### View recent cron executions

```sql
select * from cron.job_run_details
order by start_time desc
limit 10;
```

### Check Edge Function logs

```bash
supabase functions logs cerebro-digest --project-ref YOUR_REF
```

### Common issues

**No channels registered**

- Capture at least one thought from Teams or Discord first
- Check that the capture functions have the `digest_channels` table available

**Digest not being delivered**

- Verify cron jobs exist: `select * from cron.job;`
- Check `pg_net` extension is enabled
- Verify the Edge Function URL in the cron SQL matches your project
- Check the function logs for errors

**Teams delivery fails**

- Verify `TEAMS_BOT_APP_ID` and `TEAMS_BOT_APP_SECRET` are set
- The bot must have sent at least one message to the conversation before it can proactively message
- Check that the `teams_service_url` in `digest_channels` is still valid

**Discord delivery fails**

- Verify `DISCORD_BOT_TOKEN` is set
- The bot must be a member of the server and have `Send Messages` permission in the target channel
- Discord messages have a 2000 character limit — the digest function auto-splits long messages

**Cron not firing**

- Ensure both `pg_cron` and `pg_net` extensions are enabled
- The cron time is in UTC — verify your offset is correct
- Check `cron.job_run_details` for error messages

---

## Customization

### Change digest time

```sql
-- Update to run at 7 AM Central (13:00 UTC)
select cron.alter_job(
  (select jobid from cron.job where jobname = 'cerebro-daily-digest'),
  schedule := '0 13 * * *'
);
```

### Remove weekly digest

```sql
select cron.unschedule('cerebro-weekly-digest');
```

### Force a digest now (via SQL)

```sql
select net.http_post(
  url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/cerebro-digest',
  headers := jsonb_build_object('Content-Type', 'application/json'),
  body := '{"period":"daily"}'::jsonb
) as request_id;
```
