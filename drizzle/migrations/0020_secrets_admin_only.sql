DROP POLICY "admin manage ai_provider_keys" ON public.ai_provider_keys;
CREATE POLICY "admin manage ai_provider_keys" ON public.ai_provider_keys FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY "admin manage app_secrets" ON public.app_secrets;
DROP POLICY "app_secrets admin read" ON public.app_secrets;
CREATE POLICY "admin manage app_secrets" ON public.app_secrets FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));