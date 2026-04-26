-- Migration 012: Schedule Graph ingest via pg_cron + pg_net
--
-- Prerequisites:
--   1. Enable pg_cron extension:  Database → Extensions → pg_cron → Enable
--   2. Enable pg_net extension:   Database → Extensions → pg_net → Enable
--   3. Migration 011 applied (graph_ingest_state table exists)
--
-- This schedules a daily POST to the cerebro-graph-ingest Edge Function at
-- 11:00 UTC (5 AM Central) — one hour before the daily digest at 12:00 UTC,
-- so newly ingested Graph items are available for that day's digest.
--
-- NOTE: pg_cron's bgworker context does NOT resolve current_setting('app.settings.*')
-- so the URL and service_role JWT are hardcoded, matching the pattern used by
-- 003-digest-cron.sql. If you fork/redeploy, replace both values with your own.

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
    url := 'https://livdhnxdbnhxxxlgcoge.supabase.co/functions/v1/cerebro-graph-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <REDACTED_SUPABASE_JWT>'
    ),
    body := '{"source":"all"}'::jsonb,
    timeout_milliseconds := 300000
  ) as request_id;
  $$
);

