DROP FUNCTION IF EXISTS public.export_extras_sql_base() CASCADE;
CREATE OR REPLACE FUNCTION public.export_extras_sql_base()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  out_sql text := E'-- extras: extensions, sequences, views, cron jobs\n';
  r record;
BEGIN
  FOR r IN SELECT extname FROM pg_extension WHERE extname NOT IN ('plpgsql') ORDER BY extname LOOP
    out_sql := out_sql || 'CREATE EXTENSION IF NOT EXISTS ' || quote_ident(r.extname) || E' WITH SCHEMA extensions;\n';
  END LOOP;

  out_sql := out_sql || E'\n-- sequences\n';
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='S'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=c.oid AND d.deptype='a')
    ORDER BY c.relname
  LOOP
    out_sql := out_sql || 'CREATE SEQUENCE IF NOT EXISTS public.' || quote_ident(r.relname) || E';\n';
    out_sql := out_sql || 'GRANT USAGE, SELECT ON SEQUENCE public.' || quote_ident(r.relname) || E' TO authenticated, service_role;\n';
  END LOOP;

  out_sql := out_sql || E'\n-- views\n';
  FOR r IN SELECT viewname, definition FROM pg_views WHERE schemaname='public' ORDER BY viewname LOOP
    out_sql := out_sql || 'CREATE OR REPLACE VIEW public.' || quote_ident(r.viewname) || E' AS\n' || r.definition || E'\n';
  END LOOP;

  FOR r IN SELECT matviewname, definition FROM pg_matviews WHERE schemaname='public' ORDER BY matviewname LOOP
    out_sql := out_sql || 'CREATE MATERIALIZED VIEW IF NOT EXISTS public.' || quote_ident(r.matviewname) || E' AS\n' || r.definition || E'\n';
  END LOOP;

  FOR r IN
    SELECT grantee, table_name, string_agg(DISTINCT privilege_type, ', ') AS privs
    FROM information_schema.role_table_grants g
    WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role')
      AND EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                  WHERE n.nspname='public' AND c.relname=g.table_name AND c.relkind IN ('v','m'))
    GROUP BY grantee, table_name
  LOOP
    out_sql := out_sql || 'GRANT ' || r.privs || ' ON public.' || quote_ident(r.table_name) || ' TO ' || quote_ident(r.grantee) || E';\n';
  END LOOP;

  out_sql := out_sql || E'\n-- scheduled jobs (pg_cron)\n';
  BEGIN
    FOR r IN EXECUTE $q$ SELECT jobname, schedule, command FROM cron.job ORDER BY jobname $q$ LOOP
      out_sql := out_sql || 'SELECT cron.schedule(' || quote_literal(r.jobname) || ', ' || quote_literal(r.schedule) || ', ' || quote_literal(r.command) || E');\n';
    END LOOP;
  EXCEPTION WHEN others THEN
    out_sql := out_sql || '-- cron jobs unavailable: ' || SQLERRM || E'\n';
  END;

  RETURN out_sql;
END;
$fn$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'REVOKE EXECUTE ON FUNCTION public.export_extras_sql_base() FROM anon, authenticated';
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
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.export_extras_sql_base() TO service_role';
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
