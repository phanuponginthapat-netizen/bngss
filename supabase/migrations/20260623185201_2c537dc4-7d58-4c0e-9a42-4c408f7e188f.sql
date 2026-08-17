-- 1) ai_provider_keys: revoke column-level SELECT on api_key from client roles
DO $guard$
BEGIN
  EXECUTE 'REVOKE SELECT (api_key) ON public.ai_provider_keys FROM anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) app_secrets: admin-only access
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "admins manage app secrets" ON public.app_secrets';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "admins manage app secrets" ON public.app_secrets';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "admins manage app secrets" ON public.app_secrets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), ''admin''::app_role))
  WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 3) district_snapshots: relax restrictive policy so admins can also read NULL-school rows
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS school_scope_restrictive ON public.district_snapshots';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY school_scope_restrictive ON public.district_snapshots
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    (school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid()))
    OR (school_id IS NULL AND (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director'')))
  )
  WITH CHECK (
    (school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid()))
    OR (school_id IS NULL AND (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director'')))
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 4) homework_submissions: restrict viewing to assignment creator + admin/director
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "assignment owner can view submissions" ON public.homework_submissions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "assignment owner can view submissions" ON public.homework_submissions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "assignment owner can view submissions" ON public.homework_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework_assignments a
      WHERE a.id = homework_submissions.assignment_id
        AND (
          a.created_by = auth.uid()
          OR has_role(auth.uid(),''admin''::app_role)
          OR has_role(auth.uid(),''director''::app_role)
        )
    )
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
