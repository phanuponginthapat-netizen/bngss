
CREATE POLICY "auth users upload own chat files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "auth users read chat files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "auth users delete own chat files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
