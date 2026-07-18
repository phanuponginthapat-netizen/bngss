
DROP POLICY IF EXISTS "Staff can view students" ON public.students;
DROP POLICY IF EXISTS "Teachers can view students in their school" ON public.students;

CREATE POLICY "Staff view students in their school"
ON public.students FOR SELECT
TO authenticated
USING (
  ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
   AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid())))
  OR (has_role(auth.uid(), 'teacher'::app_role)
      AND school_id IS NOT NULL
      AND school_id = get_user_school_id(auth.uid()))
  OR auth_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.line_user_id IS NOT NULL
      AND (p.line_user_id = students.line_user_id
           OR p.line_user_id = students.line_user_id_2
           OR p.line_user_id = students.line_user_id_3)
  )
);

CREATE OR REPLACE FUNCTION public.get_student_pii(_student_id uuid)
RETURNS TABLE (
  national_id text, father_id text, mother_id text,
  father_phone text, mother_phone text, guardian_phone text, emergency_phone text,
  parent_phone_1 text, parent_phone_2 text, parent_phone_3 text,
  address text, phone text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _is_admin boolean; _is_self boolean; _is_parent boolean;
BEGIN
  _is_admin := has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role);
  SELECT EXISTS(SELECT 1 FROM public.students s WHERE s.id = _student_id AND s.auth_user_id = auth.uid()) INTO _is_self;
  SELECT EXISTS(
    SELECT 1 FROM public.profiles p, public.students s
    WHERE s.id = _student_id AND p.id = auth.uid() AND p.line_user_id IS NOT NULL
      AND (p.line_user_id = s.line_user_id OR p.line_user_id = s.line_user_id_2 OR p.line_user_id = s.line_user_id_3)
  ) INTO _is_parent;
  IF NOT (_is_admin OR _is_self OR _is_parent) THEN
    RAISE EXCEPTION 'Not authorized to view student PII';
  END IF;
  RETURN QUERY
  SELECT s.national_id, s.father_id, s.mother_id, s.father_phone, s.mother_phone,
         s.guardian_phone, s.emergency_phone, s.parent_phone_1, s.parent_phone_2,
         s.parent_phone_3, s.address, s.phone
  FROM public.students s WHERE s.id = _student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_pii(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_student_pii(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_student_pii(uuid) TO authenticated;
