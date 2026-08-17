-- 1. Personnel INSERT: restrict to admin/director only (was: any authenticated user)
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert their own personnel record" ON public.personnel';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins manage personnel inserts" ON public.personnel';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins manage personnel inserts" ON public.personnel';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Admins manage personnel inserts"
ON public.personnel FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''director'')
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2. face-photos bucket: restrict INSERT to staff roles only
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth users can upload face photos" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can upload face photos" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can upload face photos" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Staff can upload face photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = ''face-photos'' AND (
    public.has_role(auth.uid(),''admin'')
    OR public.has_role(auth.uid(),''director'')
    OR public.has_role(auth.uid(),''teacher'')
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 3. attendance-photos bucket: restrict INSERT to staff roles only
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth users can upload attendance photos" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can upload attendance photos" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can upload attendance photos" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Staff can upload attendance photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = ''attendance-photos'' AND (
    public.has_role(auth.uid(),''admin'')
    OR public.has_role(auth.uid(),''director'')
    OR public.has_role(auth.uid(),''teacher'')
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 4. audit_logs: remove direct user INSERT; force via SECURITY DEFINER function
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users insert own audit_logs" ON public.audit_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DROP FUNCTION IF EXISTS public.log_audit_event(text, jsonb, text, text) CASCADE;
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _details jsonb DEFAULT NULL,
  _resource_type text DEFAULT NULL,
  _resource_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.audit_logs (user_id, action, details, resource_type, resource_id)
  VALUES (auth.uid(), _action, _details, _resource_type, _resource_id)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
-- 5. profiles: prevent users from clearing their own must_change_password
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users update own profile (preserve must_change_password)" ON public.profiles';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users update own profile (preserve must_change_password)" ON public.profiles';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Users update own profile (preserve must_change_password)"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND must_change_password IS NOT DISTINCT FROM (SELECT must_change_password FROM public.profiles WHERE id = auth.uid())
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 6. home_visits: tighten homeroom teacher access to use personnel.user_id
-- (replace the name-string match with personnel-table identity match)
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Homeroom teacher manage home_visits" ON public.home_visits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Homeroom teacher manage home_visits (secure)" ON public.home_visits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Homeroom teacher manage home_visits (secure)" ON public.home_visits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Homeroom teacher manage home_visits (secure)"
ON public.home_visits FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.classrooms c ON c.id = s.classroom_id
    JOIN public.personnel p ON p.user_id = auth.uid()
    WHERE s.id = home_visits.student_id
      AND (
        c.homeroom_teacher = CONCAT(p.prefix, p.first_name, '' '', p.last_name)
        OR c.homeroom_teacher = CONCAT(p.first_name, '' '', p.last_name)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.classrooms c ON c.id = s.classroom_id
    JOIN public.personnel p ON p.user_id = auth.uid()
    WHERE s.id = home_visits.student_id
      AND (
        c.homeroom_teacher = CONCAT(p.prefix, p.first_name, '' '', p.last_name)
        OR c.homeroom_teacher = CONCAT(p.first_name, '' '', p.last_name)
      )
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
