
CREATE POLICY "cms_assets_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'cms-assets');

CREATE POLICY "cms_assets_admin_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cms-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "cms_assets_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'cms-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "cms_assets_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cms-assets' AND public.has_role(auth.uid(), 'admin'));
