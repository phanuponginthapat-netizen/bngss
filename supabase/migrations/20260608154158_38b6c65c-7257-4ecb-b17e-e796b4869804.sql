DROP FUNCTION IF EXISTS public.find_profile_id_by_code(text) CASCADE;
CREATE OR REPLACE FUNCTION public.find_profile_id_by_code(_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles
  WHERE _code IS NOT NULL
    AND length(trim(_code)) > 0
    AND (
      lower(student_code) = lower(trim(_code))
      OR lower(employee_code) = lower(trim(_code))
    )
  LIMIT 1
$$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.find_profile_id_by_code(text) TO anon, authenticated, service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
