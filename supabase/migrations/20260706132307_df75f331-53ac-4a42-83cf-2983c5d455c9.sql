-- Speed up cms_settings RLS by memoizing auth.uid() and has_role() per statement
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins can manage cms settings" ON public.cms_settings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth view non-sensitive cms settings" ON public.cms_settings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins can manage cms settings" ON public.cms_settings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Admins can manage cms settings"
  ON public.cms_settings
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), ''admin''::app_role)))
  WITH CHECK ((SELECT public.has_role(auth.uid(), ''admin''::app_role)))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth view non-sensitive cms settings" ON public.cms_settings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Auth view non-sensitive cms settings"
  ON public.cms_settings
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), ''admin''::app_role))
    OR (SELECT public.has_role(auth.uid(), ''director''::app_role))
    OR (
      key !~~* ''id_card%''
      AND key !~~* ''%template%''
      AND key !~~* ''%secret%''
      AND key !~~* ''%internal%''
      AND key !~~* ''admin_%''
      AND key !~~* ''%ai_bot%''
      AND key !~~* ''%webhook%''
      AND key !~~* ''%api_key%''
      AND key !~~* ''%token%''
    )
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Anon view public cms keys"
  ON public.cms_settings
  FOR SELECT
  TO anon
  USING (
    key !~~* ''id_card%''
    AND key !~~* ''%template%''
    AND key !~~* ''%secret%''
    AND key !~~* ''%internal%''
    AND key !~~* ''admin_%''
    AND key !~~* ''%ai_bot%''
    AND key !~~* ''%webhook%''
    AND key !~~* ''%api_key%''
    AND key !~~* ''%token%''
  )';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
