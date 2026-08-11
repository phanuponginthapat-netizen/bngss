REVOKE ALL ON FUNCTION public.check_face_duplicate(uuid, jsonb, real) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.face_distance(real[], real[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_face_duplicate(uuid, jsonb, real) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.face_distance(real[], real[]) TO authenticated, service_role;