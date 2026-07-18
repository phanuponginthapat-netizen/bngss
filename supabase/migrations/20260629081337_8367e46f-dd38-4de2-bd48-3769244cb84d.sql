
-- Make secrets / AI providers / key pool fully visible to admin & director
GRANT SELECT (value) ON public.app_secrets TO authenticated;
GRANT SELECT (api_key) ON public.ai_providers TO authenticated;
GRANT SELECT (api_key) ON public.ai_provider_keys TO authenticated;
GRANT SELECT (webhook_url) ON public.google_chat_webhooks TO authenticated;
GRANT SELECT ON public.app_secrets TO authenticated;
GRANT SELECT ON public.ai_providers TO authenticated;
GRANT SELECT ON public.ai_provider_keys TO authenticated;
GRANT SELECT ON public.google_chat_webhooks TO authenticated;

DROP POLICY IF EXISTS "admins select app secrets" ON public.app_secrets;
CREATE POLICY "admins select app secrets" ON public.app_secrets
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

DROP POLICY IF EXISTS "Admin/director select ai_providers" ON public.ai_providers;
CREATE POLICY "Admin/director select ai_providers" ON public.ai_providers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

DROP POLICY IF EXISTS "Admins select ai provider keys" ON public.ai_provider_keys;
CREATE POLICY "Admins select ai provider keys" ON public.ai_provider_keys
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

DROP POLICY IF EXISTS "Admins select webhooks" ON public.google_chat_webhooks;
CREATE POLICY "Admins select webhooks" ON public.google_chat_webhooks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));
