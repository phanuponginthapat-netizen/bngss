DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth view all cms settings" ON public.cms_settings';
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
  has_role(auth.uid(), ''admin''::app_role)
  OR has_role(auth.uid(), ''director''::app_role)
  OR (
    (key !~~* ''id_card%'')
    AND (key !~~* ''%template%'')
    AND (key !~~* ''%secret%'')
    AND (key !~~* ''%internal%'')
    AND (key !~~* ''admin_%'')
    AND (key !~~* ''%ai_bot%'')
    AND (key !~~* ''%webhook%'')
    AND (key !~~* ''%api_key%'')
    AND (key !~~* ''%token%'')
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
