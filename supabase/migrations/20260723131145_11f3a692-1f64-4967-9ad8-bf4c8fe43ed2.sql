
-- cms-logos: public read, admin/director write
CREATE POLICY "cms-logos public read" ON storage.objects FOR SELECT USING (bucket_id = 'cms-logos');
CREATE POLICY "cms-logos admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cms-logos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));
CREATE POLICY "cms-logos admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cms-logos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));
CREATE POLICY "cms-logos admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cms-logos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

-- padlet-media: public read, any authenticated write, owner/admin delete
CREATE POLICY "padlet-media public read" ON storage.objects FOR SELECT USING (bucket_id = 'padlet-media');
CREATE POLICY "padlet-media auth write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'padlet-media');
CREATE POLICY "padlet-media owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'padlet-media' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "padlet-media owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'padlet-media' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));

-- documents: authenticated read/write
CREATE POLICY "documents auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "documents auth write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "documents owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "documents owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));

-- backups: admin only
CREATE POLICY "backups admin read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "backups admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "backups admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "backups admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
