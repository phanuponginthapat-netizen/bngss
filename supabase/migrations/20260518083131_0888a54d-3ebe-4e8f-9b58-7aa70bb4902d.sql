GRANT EXECUTE ON FUNCTION public.archive_old_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_and_purge_old_data(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purge_preview(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cloud_usage_summary() TO authenticated;