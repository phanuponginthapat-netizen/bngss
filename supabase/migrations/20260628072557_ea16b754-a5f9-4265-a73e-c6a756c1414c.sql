DROP FUNCTION IF EXISTS public.lookup_student_for_public_form(text);
CREATE FUNCTION public.lookup_student_for_public_form(_code text)
RETURNS TABLE(
  id uuid, student_code text, prefix text, first_name text, last_name text,
  national_id text, date_of_birth date, gender text, address text, phone text,
  nationality text, ethnicity text, religion text, blood_type text,
  birth_province text, previous_school text, admission_date date,
  weight numeric, height numeric, photo_url text,
  classroom_id uuid, school_id uuid,
  guardian_name text, guardian_phone text, guardian_relation text,
  father_name text, father_phone text, father_occupation text, father_id text,
  mother_name text, mother_phone text, mother_occupation text, mother_id text,
  emergency_contact text, emergency_phone text,
  special_needs text, is_special_needs boolean, special_needs_type text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id, s.student_code, s.prefix, s.first_name, s.last_name,
         s.national_id, s.date_of_birth, s.gender, s.address, s.phone,
         s.nationality, s.ethnicity, s.religion, s.blood_type,
         s.birth_province, s.previous_school, s.admission_date,
         s.weight, s.height, s.photo_url,
         s.classroom_id, s.school_id,
         s.guardian_name, s.guardian_phone, s.guardian_relation,
         s.father_name, s.father_phone, s.father_occupation, s.father_id,
         s.mother_name, s.mother_phone, s.mother_occupation, s.mother_id,
         s.emergency_contact, s.emergency_phone,
         s.special_needs, s.is_special_needs, s.special_needs_type
  FROM public.students s
  WHERE s.student_code = _code AND s.status = 'active'
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.lookup_student_for_public_form(text) TO anon, authenticated, service_role;