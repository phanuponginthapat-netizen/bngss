-- Fix 1: home_visits homeroom policy — use UUID matching instead of fragile name string matching
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Homeroom teacher manage home_visits (secure)" ON public.home_visits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Homeroom teacher manage home_visits (secure)" ON public.home_visits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Homeroom teacher manage home_visits (secure)"
ON public.home_visits
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = home_visits.student_id
      AND public.is_homeroom_of_classroom(auth.uid(), s.classroom_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = home_visits.student_id
      AND public.is_homeroom_of_classroom(auth.uid(), s.classroom_id)
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Fix 2: students teacher SELECT — scope to same school as the teacher
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can view all students" ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can view students in their school" ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can view students in their school" ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Staff can view students in their school"
ON public.students
FOR SELECT
USING (
  has_role(auth.uid(), ''admin''::app_role)
  OR has_role(auth.uid(), ''director''::app_role)
  OR (
    has_role(auth.uid(), ''teacher''::app_role)
    AND (
      school_id IS NULL
      OR school_id = public.get_user_school_id(auth.uid())
      OR public.get_user_school_id(auth.uid()) IS NULL
    )
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
