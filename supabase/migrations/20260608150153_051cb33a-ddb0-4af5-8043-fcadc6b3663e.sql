
-- portfolio bucket policies
CREATE POLICY "portfolio read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'portfolio');
CREATE POLICY "portfolio upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "portfolio update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "portfolio delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

-- wall-media bucket policies
CREATE POLICY "wall read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'wall-media');
CREATE POLICY "wall upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'wall-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wall update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'wall-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "wall delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'wall-media' AND (storage.foldername(name))[1] = auth.uid()::text);
