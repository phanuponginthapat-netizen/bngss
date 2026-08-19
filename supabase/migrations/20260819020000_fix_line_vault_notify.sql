-- Fix LINE Vault notifications not firing.
-- Root causes:
--   1) SUPABASE_URL missing from app_secrets AND app.settings.supabase_url unset
--      -> line_vault_dispatch() returned early (base_url NULL) -> no pg_net call
--      -> leaves/substitute notifications never dispatched.
--   2) line_vault_staff_leave_ins/upd and line_vault_substitute_ins triggers
--      are missing on the remote -> staff leave / substitute notifications never fire.
--   3) line-vault-calendar-digest cron job missing -> calendar digest never auto-sent.

-- 1) Ensure SUPABASE_URL in app_secrets (canonical project URL)
DO $guard$
DECLARE _try int := 0;
BEGIN
  LOOP
    BEGIN
      SET LOCAL lock_timeout = '5s';
      INSERT INTO public.app_secrets(key, value, category, description, updated_at)
      VALUES ('SUPABASE_URL', 'https://gwmszzoqqxmejefhayqf.supabase.co', 'auto',
              'Supabase project URL (used by line_vault_dispatch / cron scheduling)', now())
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            category = COALESCE(EXCLUDED.category, public.app_secrets.category),
            updated_at = now();
      EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _try := _try + 1;
        IF _try >= 10 THEN EXIT; END IF;
        PERFORM pg_sleep(0.4 * _try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR duplicate_object THEN
        RAISE NOTICE 'skipped SUPABASE_URL upsert: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;

-- 2) Harden line_vault_dispatch: fall back to the canonical project URL when
--    SUPABASE_URL is absent (same pattern as ensure_attendance_digest_cron).
DROP FUNCTION IF EXISTS public.line_vault_dispatch(text, jsonb) CASCADE;
CREATE OR REPLACE FUNCTION public.line_vault_dispatch(category text, payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url text;
  cron_secret text;
  fn_url text;
BEGIN
  SELECT value INTO base_url FROM public.app_secrets WHERE key = 'SUPABASE_URL';
  IF base_url IS NULL OR base_url = '' OR base_url LIKE '%dlkyxvhnnffblerwedjz%' THEN
    base_url := current_setting('app.settings.supabase_url', true);
  END IF;
  IF base_url IS NULL OR base_url = '' OR base_url LIKE '%dlkyxvhnnffblerwedjz%' THEN
    base_url := 'https://gwmszzoqqxmejefhayqf.supabase.co';
  END IF;
  base_url := rtrim(base_url, '/');
  SELECT value INTO cron_secret FROM public.app_secrets WHERE key = 'CRON_SECRET';
  IF base_url IS NULL OR cron_secret IS NULL THEN
    RETURN;
  END IF;
  fn_url := base_url || '/functions/v1/notify-line-vault-groups';
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object('category', category, 'payload', payload)
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'line_vault_dispatch failed: %', SQLERRM;
END;
$$;

-- 3) Recreate missing staff_leave triggers
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS line_vault_staff_leave_ins ON public.staff_leaves';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN EXIT; END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE TRIGGER line_vault_staff_leave_ins
      AFTER INSERT ON public.staff_leaves
      FOR EACH ROW EXECUTE FUNCTION public.trg_line_vault_staff_leave()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN EXIT; END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS line_vault_staff_leave_upd ON public.staff_leaves';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN EXIT; END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE TRIGGER line_vault_staff_leave_upd
      AFTER UPDATE OF status ON public.staff_leaves
      FOR EACH ROW EXECUTE FUNCTION public.trg_line_vault_staff_leave()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN EXIT; END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;

-- 4) Recreate missing substitute trigger
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS line_vault_substitute_ins ON public.substitute_teaching';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN EXIT; END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE TRIGGER line_vault_substitute_ins
      AFTER INSERT ON public.substitute_teaching
      FOR EACH ROW EXECUTE FUNCTION public.trg_line_vault_substitute()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN EXIT; END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;

-- 5) Schedule daily calendar digest at 07:00 Asia/Bangkok (00:00 UTC)
DO $$
DECLARE
  base_url text;
  cron_secret text;
BEGIN
  SELECT value INTO base_url FROM public.app_secrets WHERE key = 'SUPABASE_URL';
  IF base_url IS NULL OR base_url = '' OR base_url LIKE '%dlkyxvhnnffblerwedjz%' THEN
    base_url := 'https://gwmszzoqqxmejefhayqf.supabase.co';
  END IF;
  base_url := rtrim(base_url, '/');
  SELECT value INTO cron_secret FROM public.app_secrets WHERE key = 'CRON_SECRET';
  IF base_url IS NULL OR cron_secret IS NULL THEN
    RAISE NOTICE 'Skipping calendar digest cron — SUPABASE_URL or CRON_SECRET missing';
    RETURN;
  END IF;
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'Skipping calendar digest cron — pg_cron not installed';
    RETURN;
  END IF;
  BEGIN
    PERFORM cron.unschedule('line-vault-calendar-digest')
    FROM cron.job WHERE jobname = 'line-vault-calendar-digest';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM cron.schedule(
    'line-vault-calendar-digest',
    '0 0 * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $cmd$,
      base_url || '/functions/v1/notify-calendar-digest',
      jsonb_build_object('Content-Type','application/json','x-cron-secret', cron_secret)::text
    )
  );
  RAISE NOTICE 'line-vault-calendar-digest scheduled -> %', base_url || '/functions/v1/notify-calendar-digest';
END $$;