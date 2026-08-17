DO $guard$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_homeroom_on_ai_risk() FROM anon, authenticated, public';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Borrower can view own ict loan photos" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Borrower can view own ict loan photos" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Borrower can view own ict loan photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = ''ict-loan-photos''
  AND EXISTS (
    SELECT 1
    FROM public.ict_loans l
    LEFT JOIN public.students s ON s.id = l.student_id
    LEFT JOIN public.personnel p ON p.id = l.personnel_id
    WHERE (l.borrow_photo_url LIKE ''%'' || storage.objects.name || ''%''
           OR l.return_photo_url LIKE ''%'' || storage.objects.name || ''%'')
      AND (s.auth_user_id = auth.uid() OR p.user_id = auth.uid())
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
