-- Restrict anon access to cms_settings: exclude ai_bot keys
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings';
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
  EXECUTE 'CREATE POLICY "Anon view public cms keys" ON public.cms_settings
FOR SELECT TO anon
USING (
  (key !~~* ''id_card%'')
  AND (key !~~* ''%template%'')
  AND (key !~~* ''%secret%'')
  AND (key !~~* ''%internal%'')
  AND (key !~~* ''admin_%'')
  AND (key !~~* ''%ai_bot%'')
  AND (key !~~* ''%webhook%'')
  AND (key !~~* ''%api_key%'')
  AND (key !~~* ''%token%'')
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Allow eform recipients to read PDFs addressed to them
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "eform-pdfs recipient can read" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "eform-pdfs recipient can read" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "eform-pdfs recipient can read"
ON storage.objects FOR SELECT
USING (
  bucket_id = ''eform-pdfs''
  AND can_access_eform(
    (NULLIF((storage.foldername(name))[1], ''''))::uuid,
    auth.uid()
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
