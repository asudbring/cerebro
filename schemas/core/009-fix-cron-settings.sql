-- 009: Fix cron jobs to handle missing settings gracefully
-- Uses current_setting with missing_ok=true to avoid runtime errors
-- if app.settings are not configured.

-- Unschedule existing jobs (safe if they don't exist)
SELECT cron.unschedule('cerebro-daily-digest');
SELECT cron.unschedule('cerebro-weekly-digest');

-- Daily digest: every day at 12:00 UTC (6 AM Central / 7 AM Eastern)
-- Uses current_setting(..., true) to return NULL instead of erroring if not set.
SELECT cron.schedule(
  'cerebro-daily-digest',
  '0 12 * * *',
  $$
  DO $do$
  DECLARE
    base_url text := current_setting('app.settings.supabase_url', true);
    svc_key  text := current_setting('app.settings.service_role_key', true);
  BEGIN
    IF base_url IS NULL OR svc_key IS NULL THEN
      RAISE WARNING 'cerebro-daily-digest: app.settings.supabase_url or service_role_key not configured, skipping';
      RETURN;
    END IF;
    PERFORM net.http_post(
      url := base_url || '/functions/v1/cerebro-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := '{"period":"daily"}'::jsonb,
      timeout_milliseconds := 30000
    );
  END $do$;
  $$
);

-- Weekly digest: every Sunday at 18:00 UTC (12 PM Central / 1 PM Eastern)
SELECT cron.schedule(
  'cerebro-weekly-digest',
  '0 18 * * 0',
  $$
  DO $do$
  DECLARE
    base_url text := current_setting('app.settings.supabase_url', true);
    svc_key  text := current_setting('app.settings.service_role_key', true);
  BEGIN
    IF base_url IS NULL OR svc_key IS NULL THEN
      RAISE WARNING 'cerebro-weekly-digest: app.settings.supabase_url or service_role_key not configured, skipping';
      RETURN;
    END IF;
    PERFORM net.http_post(
      url := base_url || '/functions/v1/cerebro-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := '{"period":"weekly"}'::jsonb,
      timeout_milliseconds := 30000
    );
  END $do$;
  $$
);
