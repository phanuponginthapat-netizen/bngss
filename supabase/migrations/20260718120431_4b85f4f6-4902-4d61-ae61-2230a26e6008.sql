-- 1) chat_reports: constrain admin updates with WITH CHECK
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "admin updates reports" ON public.chat_reports';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "admin updates reports" ON public.chat_reports';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "admin updates reports" ON public.chat_reports
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), ''admin''::app_role))
  WITH CHECK (
    has_role(auth.uid(), ''admin''::app_role)
    AND reporter_id = (SELECT reporter_id FROM public.chat_reports r WHERE r.id = chat_reports.id)
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) game_hub_scores: replace open SELECT with scoped policy
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "scores_read_all_auth" ON public.game_hub_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "scores_read_own" ON public.game_hub_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "scores_read_own" ON public.game_hub_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "scores_read_own" ON public.game_hub_scores
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid())';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "scores_read_staff_same_school" ON public.game_hub_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "scores_read_staff_same_school" ON public.game_hub_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "scores_read_staff_same_school" ON public.game_hub_scores
  FOR SELECT TO authenticated
  USING (
    (has_role(auth.uid(), ''admin''::app_role)
     OR has_role(auth.uid(), ''teacher''::app_role)
     OR has_role(auth.uid(), ''director''::app_role)
     OR has_role(auth.uid(), ''super_admin''::app_role))
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = game_hub_scores.student_id
        AND s.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
