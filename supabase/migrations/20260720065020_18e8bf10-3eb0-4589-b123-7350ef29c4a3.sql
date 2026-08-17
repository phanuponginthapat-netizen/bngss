
DROP POLICY IF EXISTS "padlet_read_auth" ON storage.objects;
CREATE POLICY "padlet_read_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'padlet');
DROP POLICY IF EXISTS "padlet_insert_auth" ON storage.objects;
CREATE POLICY "padlet_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'padlet' AND (storage.foldername(name))[2] = auth.uid()::text);
DROP POLICY IF EXISTS "padlet_delete_own" ON storage.objects;
CREATE POLICY "padlet_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'padlet' AND ((storage.foldername(name))[2] = auth.uid()::text OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));
DROP POLICY IF EXISTS "padlet_update_own" ON storage.objects;
CREATE POLICY "padlet_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'padlet' AND (storage.foldername(name))[2] = auth.uid()::text);
