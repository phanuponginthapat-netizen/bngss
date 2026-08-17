DROP FUNCTION IF EXISTS public.rls_policy_audit() CASCADE;
CREATE OR REPLACE FUNCTION public.rls_policy_audit()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count int,
  has_select boolean,
  has_insert boolean,
  has_update boolean,
  has_delete boolean,
  policies jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    c.relname::text AS table_name,
    c.relrowsecurity AS rls_enabled,
    COALESCE(p.cnt, 0)::int AS policy_count,
    COALESCE(p.has_select, false) AS has_select,
    COALESCE(p.has_insert, false) AS has_insert,
    COALESCE(p.has_update, false) AS has_update,
    COALESCE(p.has_delete, false) AS has_delete,
    COALESCE(p.policies, '[]'::jsonb) AS policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN (
    SELECT
      pol.schemaname,
      pol.tablename,
      COUNT(*) AS cnt,
      bool_or(pol.cmd IN ('SELECT','ALL')) AS has_select,
      bool_or(pol.cmd IN ('INSERT','ALL')) AS has_insert,
      bool_or(pol.cmd IN ('UPDATE','ALL')) AS has_update,
      bool_or(pol.cmd IN ('DELETE','ALL')) AS has_delete,
      jsonb_agg(jsonb_build_object(
        'name', pol.policyname,
        'cmd', pol.cmd,
        'roles', pol.roles,
        'permissive', pol.permissive
      ) ORDER BY pol.policyname) AS policies
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
    GROUP BY pol.schemaname, pol.tablename
  ) p ON p.schemaname = n.nspname AND p.tablename = c.relname
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY c.relname;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'REVOKE ALL ON FUNCTION public.rls_policy_audit() FROM PUBLIC, anon';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
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
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.rls_policy_audit() TO authenticated';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
