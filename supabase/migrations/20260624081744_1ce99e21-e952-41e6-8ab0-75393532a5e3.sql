-- 1) district_snapshots: restrict NULL-school rows to users who have explicit district feed access
CREATE OR REPLACE FUNCTION public.has_district_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.district_api_keys k
    WHERE k.created_by = _user_id AND COALESCE(k.is_active, true) = true
  );
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS school_scope_restrictive ON public.district_snapshots';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY school_scope_restrictive
ON public.district_snapshots
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  (school_id IS NOT NULL AND school_id = public.get_user_school_id(auth.uid()))
  OR (school_id IS NULL AND public.has_district_access(auth.uid())
      AND (public.has_role(auth.uid(), ''admin''::app_role) OR public.has_role(auth.uid(), ''director''::app_role)))
)
WITH CHECK (
  (school_id IS NOT NULL AND school_id = public.get_user_school_id(auth.uid()))
  OR (school_id IS NULL AND public.has_district_access(auth.uid())
      AND (public.has_role(auth.uid(), ''admin''::app_role) OR public.has_role(auth.uid(), ''director''::app_role)))
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) homework_submissions: students self-service via students.auth_user_id
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "students manage own submissions" ON public.homework_submissions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "students manage own submissions" ON public.homework_submissions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "students manage own submissions"
ON public.homework_submissions
FOR ALL
TO authenticated
USING (
  student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid())
)
WITH CHECK (
  student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid())
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
