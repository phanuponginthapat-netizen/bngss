CREATE OR REPLACE FUNCTION public.student_in_user_school(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = _student_id
      AND (
        public.get_user_school_id(auth.uid()) IS NULL
        OR s.school_id IS NULL
        OR s.school_id = public.get_user_school_id(auth.uid())
      )
  );
$function$;

DROP POLICY IF EXISTS "Teacher view face descriptors for scanning" ON public.student_face_descriptors;
CREATE POLICY "Teacher view face descriptors for scanning"
ON public.student_face_descriptors
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher'::public.app_role)
  AND public.student_in_user_school(student_id)
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_dept_position(uuid, public.school_department, public.dept_position) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_school_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_in_user_school(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_homeroom_of_classroom(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_teacher_assigned_to_classroom(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_dept_position(uuid, public.school_department, public.dept_position) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_school_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_in_user_school(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_homeroom_of_classroom(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_teacher_assigned_to_classroom(uuid, uuid) TO authenticated, service_role;