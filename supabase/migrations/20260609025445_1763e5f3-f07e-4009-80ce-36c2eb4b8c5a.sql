
DROP POLICY IF EXISTS "substitute-proof read auth" ON storage.objects;
DROP POLICY IF EXISTS "substitute-proof read auth" ON storage.objects;
CREATE POLICY "substitute-proof read auth"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'substitute-proof');

DROP POLICY IF EXISTS "substitute-proof insert auth" ON storage.objects;
DROP POLICY IF EXISTS "substitute-proof insert auth" ON storage.objects;
CREATE POLICY "substitute-proof insert auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'substitute-proof');

DROP POLICY IF EXISTS "substitute-proof update auth" ON storage.objects;
DROP POLICY IF EXISTS "substitute-proof update auth" ON storage.objects;
CREATE POLICY "substitute-proof update auth"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'substitute-proof');

DROP POLICY IF EXISTS "substitute-proof delete auth" ON storage.objects;
DROP POLICY IF EXISTS "substitute-proof delete auth" ON storage.objects;
CREATE POLICY "substitute-proof delete auth"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'substitute-proof');
