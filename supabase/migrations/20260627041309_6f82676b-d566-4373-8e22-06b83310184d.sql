CREATE POLICY "wsf_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'worksheet-files');
CREATE POLICY "wsf_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'worksheet-files');
CREATE POLICY "wsf_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'worksheet-files' AND owner = auth.uid());
CREATE POLICY "wsf_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'worksheet-files' AND owner = auth.uid());