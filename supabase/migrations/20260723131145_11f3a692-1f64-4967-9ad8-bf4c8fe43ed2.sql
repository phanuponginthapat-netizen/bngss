
-- cms-logos: public read, admin/director write
DROP POLICY IF EXISTS "cms-logos public read" ON storage.objects;
DROP POLICY IF EXISTS "cms-logos public read" ON storage.objects;
CREATE POLICY "cms-logos public read" ON storage.objects FOR SELECT USING (bucket_id = 'cms-logos');
DROP POLICY IF EXISTS "cms-logos admin write" ON storage.objects;
DROP POLICY IF EXISTS "cms-logos admin write" ON storage.objects;
CREATE POLICY "cms-logos admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cms-logos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));
DROP POLICY IF EXISTS "cms-logos admin update" ON storage.objects;
DROP POLICY IF EXISTS "cms-logos admin update" ON storage.objects;
CREATE POLICY "cms-logos admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cms-logos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));
DROP POLICY IF EXISTS "cms-logos admin delete" ON storage.objects;
DROP POLICY IF EXISTS "cms-logos admin delete" ON storage.objects;
CREATE POLICY "cms-logos admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cms-logos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

-- padlet-media: public read, any authenticated write, owner/admin delete
DROP POLICY IF EXISTS "padlet-media public read" ON storage.objects;
DROP POLICY IF EXISTS "padlet-media public read" ON storage.objects;
CREATE POLICY "padlet-media public read" ON storage.objects FOR SELECT USING (bucket_id = 'padlet-media');
DROP POLICY IF EXISTS "padlet-media auth write" ON storage.objects;
DROP POLICY IF EXISTS "padlet-media auth write" ON storage.objects;
CREATE POLICY "padlet-media auth write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'padlet-media');
DROP POLICY IF EXISTS "padlet-media owner update" ON storage.objects;
DROP POLICY IF EXISTS "padlet-media owner update" ON storage.objects;
CREATE POLICY "padlet-media owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'padlet-media' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS "padlet-media owner delete" ON storage.objects;
DROP POLICY IF EXISTS "padlet-media owner delete" ON storage.objects;
CREATE POLICY "padlet-media owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'padlet-media' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));

-- documents: authenticated read/write
DROP POLICY IF EXISTS "documents auth read" ON storage.objects;
DROP POLICY IF EXISTS "documents auth read" ON storage.objects;
CREATE POLICY "documents auth read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
DROP POLICY IF EXISTS "documents auth write" ON storage.objects;
DROP POLICY IF EXISTS "documents auth write" ON storage.objects;
CREATE POLICY "documents auth write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
DROP POLICY IF EXISTS "documents owner update" ON storage.objects;
DROP POLICY IF EXISTS "documents owner update" ON storage.objects;
CREATE POLICY "documents owner update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS "documents owner delete" ON storage.objects;
DROP POLICY IF EXISTS "documents owner delete" ON storage.objects;
CREATE POLICY "documents owner delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));

-- backups: admin only
DROP POLICY IF EXISTS "backups admin read" ON storage.objects;
DROP POLICY IF EXISTS "backups admin read" ON storage.objects;
CREATE POLICY "backups admin read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "backups admin write" ON storage.objects;
DROP POLICY IF EXISTS "backups admin write" ON storage.objects;
CREATE POLICY "backups admin write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "backups admin update" ON storage.objects;
DROP POLICY IF EXISTS "backups admin update" ON storage.objects;
CREATE POLICY "backups admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "backups admin delete" ON storage.objects;
DROP POLICY IF EXISTS "backups admin delete" ON storage.objects;
CREATE POLICY "backups admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'backups' AND public.has_role(auth.uid(),'admin'));
