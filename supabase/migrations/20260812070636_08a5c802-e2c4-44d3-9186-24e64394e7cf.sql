-- ตัดสิทธิ์ PUBLIC (ต้นเหตุที่ anon ยังเรียกได้)
REVOKE ALL ON FUNCTION public.enforce_school_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_notify_wall_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_notify_wall_reaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_offsite_participant_touch() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_offsite_trip_touch() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.export_extras_sql_base() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_db_schema() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_extras_sql_base() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_db_schema() TO service_role;

REVOKE ALL ON FUNCTION public.current_school_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_personnel_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_staff_profiles() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.parent_child_ids(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.parent_child_codes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.parent_child_classroom_ids(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pick_auto_substitute(integer, integer, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_school_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_personnel_directory() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_staff_profiles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.parent_child_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.parent_child_codes(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.parent_child_classroom_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pick_auto_substitute(integer, integer, uuid, uuid) TO authenticated, service_role;