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

GRANT EXECUTE ON FUNCTION public.find_profile_id_by_code(text) TO anon, authenticated, service_role;