-- Migration: Schedule daily + weekly digest via pg_cron + pg_net
--
-- Prerequisites:
--   1. Enable pg_cron extension:  Database → Extensions → pg_cron → Enable
--   2. Enable pg_net extension:   Database → Extensions → pg_net → Enable
--   3. BRAIN_KEY secret set on the cerebro-digest function:
--        npx supabase secrets set BRAIN_KEY=<your-shared-key>
--      and replace <BRAIN_KEY> below with the same value.
--
-- IMPORTANT: pg_cron's bgworker context cannot resolve current_setting('app.settings.*'),
-- so URL and shared key are baked in. We use the function's x-brain-key header
-- rather than a service_role JWT because Supabase JWT key rotation may invalidate
-- the JWT-based auth path between the function and pg_net.

-- Enable extensions (Supabase Dashboard → Database → Extensions)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Drop any prior scheduling so this migration is idempotent
select cron.unschedule(jobid)
from cron.job
where jobname in ('cerebro-daily-digest', 'cerebro-weekly-digest');

-- Daily digest: every day at 12:00 UTC (6 AM Central / 7 AM Eastern)
select cron.schedule(
  'cerebro-daily-digest',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-brain-key', '<BRAIN_KEY>'
    ),
    body := '{"period":"daily"}'::jsonb,
    timeout_milliseconds := 300000
  ) as request_id;
  $$
);

-- Weekly digest: every Sunday at 18:00 UTC (12 PM Central / 1 PM Eastern)
select cron.schedule(
  'cerebro-weekly-digest',
  '0 18 * * 0',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cerebro-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-brain-key', '<BRAIN_KEY>'
    ),
    body := '{"period":"weekly"}'::jsonb,
    timeout_milliseconds := 300000
  ) as request_id;
  $$
);

