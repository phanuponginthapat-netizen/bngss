
CREATE POLICY "Auth read procurement-files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'procurement-files');

CREATE POLICY "Auth upload procurement-files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'procurement-files');

CREATE POLICY "Auth update procurement-files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'procurement-files');

CREATE POLICY "Auth delete procurement-files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'procurement-files');
