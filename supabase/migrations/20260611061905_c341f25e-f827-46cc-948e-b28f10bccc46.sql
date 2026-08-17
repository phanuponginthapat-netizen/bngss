DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff manage student_scores" ON public.student_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins and directors manage all student_scores" ON public.student_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins and directors manage all student_scores" ON public.student_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Admins and directors manage all student_scores"
ON public.student_scores
FOR ALL
TO authenticated
USING (has_role(auth.uid(),''admin''::app_role) OR has_role(auth.uid(),''director''::app_role))
WITH CHECK (has_role(auth.uid(),''admin''::app_role) OR has_role(auth.uid(),''director''::app_role))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Teachers manage scores for their own assigned subjects" ON public.student_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Teachers manage scores for their own assigned subjects" ON public.student_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Teachers manage scores for their own assigned subjects"
ON public.student_scores
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(),''teacher''::app_role) AND EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    JOIN public.personnel p ON p.id = ta.personnel_id
    WHERE ta.subject_id = student_scores.subject_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(),''teacher''::app_role) AND EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    JOIN public.personnel p ON p.id = ta.personnel_id
    WHERE ta.subject_id = student_scores.subject_id
      AND p.user_id = auth.uid()
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
