-- Drop the overly-permissive WITH CHECK (true) insert policy.
-- Edge functions log via service_role which bypasses RLS, so no policy is needed for inserts.
DROP POLICY IF EXISTS "Service role inserts logs" ON public.ai_usage_logs;
REVOKE INSERT ON public.ai_usage_logs FROM authenticated;