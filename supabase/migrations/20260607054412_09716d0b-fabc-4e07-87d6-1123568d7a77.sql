-- 1) iot_devices: drop teacher SELECT access (api_token sensitive)
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can view iot devices" ON public.iot_devices';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) profiles: drop permissive UPDATE that bypasses must_change_password protection
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 3) student_face_descriptors: add restrictive school-scope policy for teachers
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_teacher_face_desc" ON public.student_face_descriptors';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "school_scope_teacher_face_desc" ON public.student_face_descriptors';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "school_scope_teacher_face_desc"
ON public.student_face_descriptors
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), ''admin''::app_role)
  OR has_role(auth.uid(), ''director''::app_role)
  OR NOT has_role(auth.uid(), ''teacher''::app_role)
  OR student_in_user_school(student_id)
)
WITH CHECK (
  has_role(auth.uid(), ''admin''::app_role)
  OR has_role(auth.uid(), ''director''::app_role)
  OR NOT has_role(auth.uid(), ''teacher''::app_role)
  OR student_in_user_school(student_id)
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
