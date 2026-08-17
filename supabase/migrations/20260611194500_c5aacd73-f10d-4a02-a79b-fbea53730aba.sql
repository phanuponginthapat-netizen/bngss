CREATE OR REPLACE FUNCTION public.get_classroom_subject_teachers(_classroom_id uuid)
RETURNS TABLE (
  personnel_id uuid,
  prefix text,
  first_name text,
  last_name text,
  position_name text,
  department text,
  email text,
  phone text,
  subject_id uuid,
  subject_name_th text,
  subject_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.prefix, p.first_name, p.last_name,
    p."position", p.department, p.email, p.phone,
    s.id, s.name_th, s.code
  FROM public.teacher_assignments ta
  JOIN public.personnel p ON p.id = ta.personnel_id
  LEFT JOIN public.subjects s ON s.id = ta.subject_id
  WHERE ta.classroom_id = _classroom_id;
$$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_classroom_subject_teachers(uuid) TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_classroom_subject_teachers(uuid) FROM anon, public';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
