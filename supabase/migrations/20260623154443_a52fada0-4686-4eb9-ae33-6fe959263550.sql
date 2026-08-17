-- Fix 1: Restrict eform-pdfs INSERT to staff roles (admin/director/teacher)
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated upload eform pdfs" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff upload eform pdfs" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff upload eform pdfs" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Staff upload eform pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = ''eform-pdfs''
  AND owner = auth.uid()
  AND (
    has_role(auth.uid(), ''admin''::app_role)
    OR has_role(auth.uid(), ''director''::app_role)
    OR has_role(auth.uid(), ''teacher''::app_role)
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Fix 2: Repair homework-files SELECT join logic
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Homework files: owner or same-school members" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Homework files: owner or same-school members" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Homework files: owner or same-school members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = ''homework-files''
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), ''admin''::app_role)
    OR has_role(auth.uid(), ''director''::app_role)
    OR EXISTS (
      SELECT 1
      FROM task_assignments t
      LEFT JOIN classrooms c ON c.id = t.classroom_id
      WHERE (
        t.assigned_by = auth.uid()
        OR t.assigned_to_user_id = auth.uid()
        OR (c.school_id IS NOT NULL AND c.school_id = get_user_school_id(auth.uid()))
      )
    )
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
