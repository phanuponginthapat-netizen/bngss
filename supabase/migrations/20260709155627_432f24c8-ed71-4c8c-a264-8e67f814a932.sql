-- behavior_records
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.behavior_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_teacher" ON public.behavior_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.behavior_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "school_scope_restrictive" ON public.behavior_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_teacher" ON public.behavior_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "school_scope_teacher" ON public.behavior_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT (has_role(auth.uid(),''admin''::app_role) OR has_role(auth.uid(),''director''::app_role) OR (NOT has_role(auth.uid(),''teacher''::app_role))))
    OR (SELECT student_in_user_school(behavior_records.student_id))
  )
  WITH CHECK (
    (SELECT (has_role(auth.uid(),''admin''::app_role) OR has_role(auth.uid(),''director''::app_role) OR (NOT has_role(auth.uid(),''teacher''::app_role))))
    OR (SELECT student_in_user_school(behavior_records.student_id))
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- health_records
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.health_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_teacher" ON public.health_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.health_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "school_scope_restrictive" ON public.health_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_teacher" ON public.health_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "school_scope_teacher" ON public.health_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT (has_role(auth.uid(),''admin''::app_role) OR has_role(auth.uid(),''director''::app_role) OR (NOT has_role(auth.uid(),''teacher''::app_role))))
    OR (SELECT student_in_user_school(health_records.student_id))
  )
  WITH CHECK (
    (SELECT (has_role(auth.uid(),''admin''::app_role) OR has_role(auth.uid(),''director''::app_role) OR (NOT has_role(auth.uid(),''teacher''::app_role))))
    OR (SELECT student_in_user_school(health_records.student_id))
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- sdq_records
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.sdq_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.sdq_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "school_scope_restrictive" ON public.sdq_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- exam_submissions
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "exam_submissions teacher" ON public.exam_submissions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "exam_submissions teacher" ON public.exam_submissions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "exam_submissions teacher" ON public.exam_submissions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_submissions.exam_id
      AND (e.teacher_id = auth.uid()
           OR has_role(auth.uid(),''admin''::app_role)
           OR has_role(auth.uid(),''director''::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_submissions.exam_id
      AND (e.teacher_id = auth.uid()
           OR has_role(auth.uid(),''admin''::app_role)
           OR has_role(auth.uid(),''director''::app_role))
  ))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- print_templates: restrict blanket read
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anyone authenticated can read active templates" ON public.print_templates';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated can read active templates" ON public.print_templates';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated can read active templates" ON public.print_templates';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Authenticated can read active templates" ON public.print_templates
  FOR SELECT TO authenticated
  USING (
    COALESCE(is_active, false) = true
    OR updated_by = auth.uid()
    OR has_role(auth.uid(),''admin''::app_role)
    OR has_role(auth.uid(),''director''::app_role)
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
