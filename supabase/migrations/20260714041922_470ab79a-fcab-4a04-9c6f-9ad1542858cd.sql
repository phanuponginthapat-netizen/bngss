DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "admin manage line-richmenu" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "admin manage line-richmenu" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "admin manage line-richmenu"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = ''line-richmenu'' AND (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''director'')))
WITH CHECK (bucket_id = ''line-richmenu'' AND (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''director'')))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
