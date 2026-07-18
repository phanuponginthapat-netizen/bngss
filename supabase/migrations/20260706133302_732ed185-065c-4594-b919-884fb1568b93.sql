
-- Revoke EXECUTE from anon and PUBLIC for internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.ensure_personnel_from_profile() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_personnel_avatars(uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_staff_profiles() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_district_access(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_school_members() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admins_directors(text, text, text, text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_asset_damage_report() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_health_measurement() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_ict_loan_status_change() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_vaccine_record() FROM anon, PUBLIC;

-- Ensure authenticated + service_role retain access for RPCs used by logged-in users
GRANT EXECUTE ON FUNCTION public.get_personnel_avatars(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_staff_profiles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_district_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_school_members() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notify_admins_directors(text, text, text, text, uuid) TO authenticated, service_role;
