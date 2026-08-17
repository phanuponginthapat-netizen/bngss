
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;
GRANT SELECT ON public.ai_providers_meta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_keys TO authenticated;
GRANT ALL ON public.ai_provider_keys TO service_role;
GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;

DROP POLICY IF EXISTS "Admins manage ai_providers" ON public.ai_providers;
DROP POLICY IF EXISTS "Admins manage ai_providers" ON public.ai_providers;
CREATE POLICY "Admins manage ai_providers"
  ON public.ai_providers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Admins manage ai_provider_keys" ON public.ai_provider_keys;
DROP POLICY IF EXISTS "Admins manage ai_provider_keys" ON public.ai_provider_keys;
CREATE POLICY "Admins manage ai_provider_keys"
  ON public.ai_provider_keys FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Admins read ai_usage_logs" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Admins read ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "Admins read ai_usage_logs"
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
