-- Migration 012: Schedule Graph ingest via pg_cron + pg_net
--
-- Prerequisites:
--   1. Enable pg_cron extension:  Database → Extensions → pg_cron → Enable
--   2. Enable pg_net extension:   Database → Extensions → pg_net → Enable
--   3. Migration 011 applied (graph_ingest_state table exists)
--   4. BRAIN_ACCESS_KEY secret set on the cerebro-graph-ingest function:
--        npx supabase secrets set BRAIN_ACCESS_KEY=<your-shared-key>
--      and replace <BRAIN_ACCESS_KEY> below with the same value.
--
-- This schedules a daily POST to the cerebro-graph-ingest Edge Function at
-- 11:00 UTC (5 AM Central) — one hour before the daily digest at 12:00 UTC,
-- so newly ingested Graph items are available for that day's digest.
--
-- IMPORTANT: pg_cron's bgworker context cannot resolve current_setting('app.settings.*'),
-- so URL and shared key are baked in. We use the function's x-brain-key header
-- rather than a service_role JWT because Supabase JWT key rotation may invalidate
-- the JWT-based auth path between the function and pg_net.

-- Enable extensions (Supabase Dashboard → Database → Extensions)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Drop any prior scheduling so this migration is idempotent
select cron.unschedule('cerebro-graph-ingest-daily')
where exists (select 1 from cron.job where jobname = 'cerebro-graph-ingest-daily');

-- Daily Graph ingest: every day at 11:00 UTC (5 AM Central)
select cron.schedule(
  'cerebro-graph-ingest-daily',
  '0 11 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-graph-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-brain-key', '<BRAIN_ACCESS_KEY>'
    ),
    body := '{"source":"all"}'::jsonb,
    timeout_milliseconds := 300000
  ) as request_id;
  $$
);


