
REVOKE EXECUTE ON FUNCTION public.is_homeroom_teacher_of_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_homeroom_teacher_of_student(uuid, uuid) TO authenticated, service_role;
