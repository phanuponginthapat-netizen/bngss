-- Homework assignments school scope
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.homework_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.homework_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "school_scope_restrictive" ON public.homework_assignments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Hub projects family school scope
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_projects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_projects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "school_scope_restrictive" ON public.hub_projects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_budgets';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_budgets';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "school_scope_restrictive" ON public.hub_project_budgets
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_expenses';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_expenses';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "school_scope_restrictive" ON public.hub_project_expenses
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_updates';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_updates';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "school_scope_restrictive" ON public.hub_project_updates
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- print_template_versions: restrict read
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth read versions" ON public.print_template_versions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins/directors or template updater read versions" ON public.print_template_versions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins/directors or template updater read versions" ON public.print_template_versions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Admins/directors or template updater read versions"
  ON public.print_template_versions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),''admin''::app_role)
    OR has_role(auth.uid(),''director''::app_role)
    OR EXISTS (
      SELECT 1 FROM public.print_templates t
      WHERE t.id = print_template_versions.template_id
        AND t.updated_by = auth.uid()
    )
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
