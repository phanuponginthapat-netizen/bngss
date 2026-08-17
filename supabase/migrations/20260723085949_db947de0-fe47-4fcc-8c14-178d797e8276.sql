
DROP POLICY IF EXISTS "Admins can read all cms_settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Admins can read all cms_settings" ON public.cms_settings;
CREATE POLICY "Admins can read all cms_settings" ON public.cms_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Admins can insert cms_settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Admins can insert cms_settings" ON public.cms_settings;
CREATE POLICY "Admins can insert cms_settings" ON public.cms_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Admins can update cms_settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Admins can update cms_settings" ON public.cms_settings;
CREATE POLICY "Admins can update cms_settings" ON public.cms_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Admins can delete cms_settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Admins can delete cms_settings" ON public.cms_settings;
CREATE POLICY "Admins can delete cms_settings" ON public.cms_settings
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
