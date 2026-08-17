-- Public directory of personnel: any authenticated role can read safe fields only
CREATE OR REPLACE FUNCTION public.get_personnel_directory()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  nickname text,
  avatar_url text,
  employee_code text,
  position_title text,
  department text,
  gender text,
  hire_date date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.nickname, p.avatar_url,
         p.employee_code, p.position_title, p.department, p.gender, p.hire_date
  FROM public.profiles p
  WHERE p.employee_code IS NOT NULL
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST;
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_personnel_directory() FROM PUBLIC, anon';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_personnel_directory() TO authenticated, service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Public lookup for a set of profile IDs (safe fields only)
CREATE OR REPLACE FUNCTION public.get_profiles_public(_ids uuid[])
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  nickname text,
  avatar_url text,
  employee_code text,
  student_code text,
  position_title text,
  department text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.nickname, p.avatar_url,
         p.employee_code, p.student_code, p.position_title, p.department
  FROM public.profiles p
  WHERE p.id = ANY(COALESCE(_ids, ARRAY[]::uuid[]));
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_profiles_public(uuid[]) FROM PUBLIC, anon';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_profiles_public(uuid[]) TO authenticated, service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Public lookup by student_code (avatars for ID card printing etc.)
CREATE OR REPLACE FUNCTION public.get_student_avatars_by_codes(_codes text[])
RETURNS TABLE (student_code text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.student_code, p.avatar_url
  FROM public.profiles p
  WHERE p.student_code = ANY(COALESCE(_codes, ARRAY[]::text[]));
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.get_student_avatars_by_codes(text[]) FROM PUBLIC, anon';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_student_avatars_by_codes(text[]) TO authenticated, service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
