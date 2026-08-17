
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('ai-import-temp', 'ai-import-temp', false, 26214400)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 26214400;

DROP POLICY IF EXISTS "auth users upload ai-import-temp" ON storage.objects;
CREATE POLICY "auth users upload ai-import-temp"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ai-import-temp' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "auth users read ai-import-temp" ON storage.objects;
CREATE POLICY "auth users read ai-import-temp"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ai-import-temp' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "auth users delete ai-import-temp" ON storage.objects;
CREATE POLICY "auth users delete ai-import-temp"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ai-import-temp' AND auth.uid()::text = (storage.foldername(name))[1]);
