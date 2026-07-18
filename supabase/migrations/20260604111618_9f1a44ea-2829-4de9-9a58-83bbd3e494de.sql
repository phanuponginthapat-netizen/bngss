
-- Drop redundant permissive policies (service_role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "service insert rate logs" ON public.rate_limit_logs;
DROP POLICY IF EXISTS "Service role can insert chat logs" ON public.google_chat_logs;

-- Revoke EXECUTE on internal trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.clear_classroom_on_graduation() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_classroom_homeroom_text() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_face_scan_to_attendance() FROM anon, authenticated, PUBLIC;
