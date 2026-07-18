
-- 1) ai_provider_keys: replace ALL policy with admin-only write (no SELECT for clients)
DROP POLICY IF EXISTS "Admins manage ai provider keys" ON public.ai_provider_keys;
CREATE POLICY "Admins insert ai provider keys" ON public.ai_provider_keys FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update ai provider keys" ON public.ai_provider_keys FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete ai provider keys" ON public.ai_provider_keys FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- 2) ai_providers: same treatment
DROP POLICY IF EXISTS "Admin/director manage ai_providers" ON public.ai_providers;
CREATE POLICY "Admin/director insert ai_providers" ON public.ai_providers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));
CREATE POLICY "Admin/director update ai_providers" ON public.ai_providers FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));
CREATE POLICY "Admin/director delete ai_providers" ON public.ai_providers FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

-- 3) app_secrets: same
DROP POLICY IF EXISTS "admins manage app secrets" ON public.app_secrets;
CREATE POLICY "admins insert app secrets" ON public.app_secrets FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));
CREATE POLICY "admins update app secrets" ON public.app_secrets FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')) WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));
CREATE POLICY "admins delete app secrets" ON public.app_secrets FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

-- 4) google_chat_webhooks: same
DROP POLICY IF EXISTS "Admins can manage webhooks" ON public.google_chat_webhooks;
CREATE POLICY "Admins insert webhooks" ON public.google_chat_webhooks FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update webhooks" ON public.google_chat_webhooks FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete webhooks" ON public.google_chat_webhooks FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

-- 5) iot_devices: revoke column-level SELECT on api_token from authenticated/anon
REVOKE SELECT (api_token) ON public.iot_devices FROM authenticated;
REVOKE SELECT (api_token) ON public.iot_devices FROM anon;

-- 6) procurement-files storage bucket: restrict to admin/director only
DROP POLICY IF EXISTS "Auth read procurement-files" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload procurement-files" ON storage.objects;
DROP POLICY IF EXISTS "Auth update procurement-files" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete procurement-files" ON storage.objects;

CREATE POLICY "Admin/director read procurement-files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'procurement-files' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')));
CREATE POLICY "Admin/director upload procurement-files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'procurement-files' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')));
CREATE POLICY "Admin/director update procurement-files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'procurement-files' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')))
  WITH CHECK (bucket_id = 'procurement-files' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')));
CREATE POLICY "Admin/director delete procurement-files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'procurement-files' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')));
