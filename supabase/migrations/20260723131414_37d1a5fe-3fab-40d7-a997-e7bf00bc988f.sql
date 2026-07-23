
CREATE POLICY "app_secrets admin read" ON public.app_secrets
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
