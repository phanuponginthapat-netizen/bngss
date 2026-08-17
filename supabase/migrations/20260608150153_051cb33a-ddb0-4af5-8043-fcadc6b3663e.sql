
-- portfolio bucket policies
DROP POLICY IF EXISTS "portfolio read auth" ON storage.objects;
CREATE POLICY "portfolio read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'portfolio');
DROP POLICY IF EXISTS "portfolio upload own" ON storage.objects;
CREATE POLICY "portfolio upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "portfolio update own" ON storage.objects;
CREATE POLICY "portfolio update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "portfolio delete own" ON storage.objects;
CREATE POLICY "portfolio delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'portfolio' AND (storage.foldername(name))[1] = auth.uid()::text);

-- wall-media bucket policies
DROP POLICY IF EXISTS "wall read auth" ON storage.objects;
CREATE POLICY "wall read auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'wall-media');
DROP POLICY IF EXISTS "wall upload own" ON storage.objects;
CREATE POLICY "wall upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'wall-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "wall update own" ON storage.objects;
CREATE POLICY "wall update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'wall-media' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "wall delete own" ON storage.objects;
CREATE POLICY "wall delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'wall-media' AND (storage.foldername(name))[1] = auth.uid()::text);
