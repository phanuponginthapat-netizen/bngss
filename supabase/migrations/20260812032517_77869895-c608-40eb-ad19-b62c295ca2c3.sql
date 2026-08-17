-- Helper: children ids of a parent (security definer, avoids RLS recursion)
DROP FUNCTION IF EXISTS public.parent_child_ids(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.parent_child_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(s.id), '{}')
  FROM public.students s
  WHERE (s.parent_user_id = _user_id OR s.parent_user_id_2 = _user_id)
    AND public.has_role(_user_id, 'parent'::app_role);
$$;
DROP FUNCTION IF EXISTS public.parent_child_codes(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.parent_child_codes(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(s.student_code), '{}')
  FROM public.students s
  WHERE (s.parent_user_id = _user_id OR s.parent_user_id_2 = _user_id)
    AND public.has_role(_user_id, 'parent'::app_role);
$$;
DROP FUNCTION IF EXISTS public.parent_child_classroom_ids(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.parent_child_classroom_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT s.classroom_id) FILTER (WHERE s.classroom_id IS NOT NULL), '{}')
  FROM public.students s
  WHERE (s.parent_user_id = _user_id OR s.parent_user_id_2 = _user_id)
    AND public.has_role(_user_id, 'parent'::app_role);
$$;
-- students: parents can read only their own children
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view their children" ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view their children" ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents view their children"
ON public.students FOR SELECT TO authenticated
USING (
  (parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid())
  AND public.has_role(auth.uid(), ''parent''::app_role)
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- health records
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view child health records" ON public.health_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view child health records" ON public.health_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents view child health records"
ON public.health_records FOR SELECT TO authenticated
USING (student_id = ANY (public.parent_child_ids(auth.uid())))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- SDQ
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view child sdq" ON public.sdq_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view child sdq" ON public.sdq_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents view child sdq"
ON public.sdq_records FOR SELECT TO authenticated
USING (student_id = ANY (public.parent_child_ids(auth.uid())))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- enrollments
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view child enrollments" ON public.enrollments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view child enrollments" ON public.enrollments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents view child enrollments"
ON public.enrollments FOR SELECT TO authenticated
USING (student_id = ANY (public.parent_child_ids(auth.uid())))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- scores
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view child scores" ON public.student_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view child scores" ON public.student_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents view child scores"
ON public.student_scores FOR SELECT TO authenticated
USING (student_code = ANY (public.parent_child_codes(auth.uid())))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- homework / task assignments (personal + class-wide)
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view child homework" ON public.task_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view child homework" ON public.task_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents view child homework"
ON public.task_assignments FOR SELECT TO authenticated
USING (
  assigned_to_student_id = ANY (public.parent_child_ids(auth.uid()))
  OR (
    assigned_to_student_id IS NULL
    AND classroom_id = ANY (public.parent_child_classroom_ids(auth.uid()))
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
