
-- Lock down admin-only maintenance functions: revoke from anon
REVOKE EXECUTE ON FUNCTION public.archive_and_purge_old_data(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.archive_old_data() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_purge_preview(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_cloud_usage_summary() FROM anon, public;

-- These functions already check has_role internally; only authenticated should reach them
GRANT EXECUTE ON FUNCTION public.archive_and_purge_old_data(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purge_preview(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cloud_usage_summary() TO authenticated;
