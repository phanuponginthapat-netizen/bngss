-- Dedupe shortcut tables: keep earliest row per target_url, drop the duplicates
-- (each item was seeded 3x on 2026-07-18 + 2026-08-18), then add a UNIQUE index
-- on target_url so the seed's ON CONFLICT / NOT EXISTS logic actually dedupes.

-- dashboard_shortcuts: 42 -> 14
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      DELETE FROM public.dashboard_shortcuts a
      USING public.dashboard_shortcuts b
      WHERE a.target_url = b.target_url
        AND a.created_at > b.created_at;
      EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN EXIT; END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped dedupe dashboard_shortcuts: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;

-- browser_shortcuts: 30 -> 10
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      DELETE FROM public.browser_shortcuts a
      USING public.browser_shortcuts b
      WHERE a.target_url = b.target_url
        AND a.created_at > b.created_at;
      EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN EXIT; END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped dedupe browser_shortcuts: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;

-- Add UNIQUE index on target_url (both tables) so future seeds can't re-insert dupes.
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      CREATE UNIQUE INDEX IF NOT EXISTS dashboard_shortcuts_target_url_key
        ON public.dashboard_shortcuts (target_url);
      EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN EXIT; END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped unique index dashboard_shortcuts: %', SQLERRM;
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
      CREATE UNIQUE INDEX IF NOT EXISTS browser_shortcuts_target_url_key
        ON public.browser_shortcuts (target_url);
      EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN EXIT; END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped unique index browser_shortcuts: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;