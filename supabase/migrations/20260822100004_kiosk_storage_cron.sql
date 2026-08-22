-- Kiosk offline alert + storage cleanup cron (pg_cron if available) - runs edge functions via pg_net
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('kiosk-offline-alert', '*/5 * * * *', $cron$ SELECT net.http_post(url := (SELECT value->>'url' FROM app_settings WHERE key='supabase_url') || '/functions/v1/kiosk-offline-alert', headers := jsonb_build_object('Authorization','Bearer ' || (SELECT value->>'key' FROM app_settings WHERE key='service_role_key'),'Content-Type','application/json'), body := '{}'::jsonb); $cron$);
    PERFORM cron.schedule('obec-calendar-sync', '0 3 * * *', $cron$ SELECT net.http_post(url := (SELECT value->>'url' FROM app_settings WHERE key='supabase_url') || '/functions/v1/obec-calendar-sync', headers := jsonb_build_object('Authorization','Bearer ' || (SELECT value->>'key' FROM app_settings WHERE key='service_role_key'),'Content-Type','application/json'), body := '{}'::jsonb); $cron$);
    PERFORM cron.schedule('cleanup-orphan-storage-weekly', '0 4 * * 0', $cron$ SELECT net.http_post(url := (SELECT value->>'url' FROM app_settings WHERE key='supabase_url') || '/functions/v1/cleanup-orphan-storage', headers := jsonb_build_object('Authorization','Bearer ' || (SELECT value->>'key' FROM app_settings WHERE key='service_role_key'),'Content-Type','application/json'), body := '{"minAgeDays":7}'::jsonb); $cron$);
  END IF;
END $outer$;
