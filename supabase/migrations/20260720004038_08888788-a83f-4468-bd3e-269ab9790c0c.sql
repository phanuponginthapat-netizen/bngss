DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'ALTER TABLE public.line_vault_groups
      ADD COLUMN IF NOT EXISTS notify_attendance boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS last_attendance_digest_date date';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
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
