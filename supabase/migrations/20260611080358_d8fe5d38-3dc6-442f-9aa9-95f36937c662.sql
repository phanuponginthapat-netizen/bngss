-- Mass-fix: convert all public-role policies that reference auth.uid()/has_role
-- to authenticated-only. This prevents anon callers from triggering security
-- definer functions they don't have EXECUTE on (e.g. permission denied for
-- function get_user_school_id).

DO $mig$
DECLARE
  r RECORD;
  cmd_clause text;
  using_clause text;
  check_clause text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'public' = ANY(roles)
      AND (
        COALESCE(qual,'')       ~ '(auth\.uid\(\)|has_role|is_homeroom_of_classroom|is_parent_of_student|get_user_school_id)'
        OR COALESCE(with_check,'') ~ '(auth\.uid\(\)|has_role|is_homeroom_of_classroom|is_parent_of_student|get_user_school_id)'
      )
  LOOP
    cmd_clause := CASE r.cmd
      WHEN 'ALL'    THEN 'FOR ALL'
      WHEN 'SELECT' THEN 'FOR SELECT'
      WHEN 'INSERT' THEN 'FOR INSERT'
      WHEN 'UPDATE' THEN 'FOR UPDATE'
      WHEN 'DELETE' THEN 'FOR DELETE'
      ELSE 'FOR ALL'
    END;

    using_clause := CASE WHEN r.qual IS NOT NULL THEN ' USING (' || r.qual || ')' ELSE '' END;
    check_clause := CASE WHEN r.with_check IS NOT NULL THEN ' WITH CHECK (' || r.with_check || ')' ELSE '' END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I %s TO authenticated%s%s',
      r.policyname, r.schemaname, r.tablename,
      cmd_clause, using_clause, check_clause
    );
  END LOOP;
END
$mig$;
-- Safety net: anon can call permission helpers (they self-evaluate to false/null for anon)
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $g$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='is_homeroom_of_classroom') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_homeroom_of_classroom(uuid, uuid) TO anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
             WHERE n.nspname='public' AND p.proname='is_parent_of_student') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_parent_of_student(uuid, uuid) TO anon';
  END IF;
END
$g$;
