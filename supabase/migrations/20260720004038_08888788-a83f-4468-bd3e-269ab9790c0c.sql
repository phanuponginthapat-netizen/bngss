DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.line_vault_groups
  ADD COLUMN IF NOT EXISTS notify_attendance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_attendance_digest_date date';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $$
DECLARE
  base_url text;
  cron_secret text;
BEGIN
  SELECT value INTO base_url FROM public.app_secrets WHERE key = 'SUPABASE_URL';
  SELECT value INTO cron_secret FROM public.app_secrets WHERE key = 'CRON_SECRET';
  IF base_url IS NULL OR cron_secret IS NULL THEN
    RAISE NOTICE 'Skipping cron schedule — SUPABASE_URL or CRON_SECRET missing';
    RETURN;
  END IF;
  PERFORM cron.unschedule('line-vault-attendance-digest') FROM cron.job WHERE jobname = 'line-vault-attendance-digest';
  -- 10:00 Asia/Bangkok = 03:00 UTC, Monday-Friday
  PERFORM cron.schedule(
    'line-vault-attendance-digest',
    '0 3 * * 1-5',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $cmd$,
      base_url || '/functions/v1/notify-attendance-digest',
      jsonb_build_object('Content-Type','application/json','x-cron-secret', cron_secret)::text
    )
  );
END $$;
