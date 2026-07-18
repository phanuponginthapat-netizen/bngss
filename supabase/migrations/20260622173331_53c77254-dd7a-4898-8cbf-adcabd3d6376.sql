REVOKE EXECUTE ON FUNCTION public.auto_assign_school_id() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_print_template_version() FROM anon, authenticated, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_user_school_id(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_homeroom_of_classroom(uuid, uuid) FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.reset_content_data() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_content_data() TO service_role;