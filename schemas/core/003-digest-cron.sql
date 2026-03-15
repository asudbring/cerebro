-- Migration: Schedule daily digest via pg_cron + pg_net
--
-- Prerequisites:
--   1. Enable pg_cron extension:  Database → Extensions → pg_cron → Enable
--   2. Enable pg_net extension:   Database → Extensions → pg_net → Enable
--
-- This schedules a daily POST to the cerebro-digest Edge Function at 12:00 UTC (6 AM Central).
-- Adjust the cron expression and URL to match your setup.

-- Enable extensions (Supabase Dashboard → Database → Extensions)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Daily digest: every day at 12:00 UTC (6 AM Central / 7 AM Eastern)
select cron.schedule(
  'cerebro-daily-digest',
  '0 12 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cerebro-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"period":"daily"}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

-- Weekly digest: every Sunday at 18:00 UTC (12 PM Central / 1 PM Eastern)
select cron.schedule(
  'cerebro-weekly-digest',
  '0 18 * * 0',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/cerebro-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"period":"weekly"}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
