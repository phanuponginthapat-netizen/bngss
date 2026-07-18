
REVOKE ALL ON FUNCTION public.cleanup_browser_logs_90d() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_browser_logs_90d() TO postgres, service_role;
