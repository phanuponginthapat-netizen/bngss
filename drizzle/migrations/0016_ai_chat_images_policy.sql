DROP POLICY IF EXISTS "Users read own ai chat images" ON storage.objects;
CREATE POLICY "Users read own ai chat images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ai-chat-images' AND (storage.foldername(name))[1] = auth.uid()::text);