-- CI (anon key) can upload/overwrite/delete APKs in app-downloads; anyone can read
DROP POLICY IF EXISTS "app_downloads_ci_insert" ON storage.objects;
CREATE POLICY "app_downloads_ci_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'app-downloads');

DROP POLICY IF EXISTS "app_downloads_ci_update" ON storage.objects;
CREATE POLICY "app_downloads_ci_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'app-downloads')
  WITH CHECK (bucket_id = 'app-downloads');

DROP POLICY IF EXISTS "app_downloads_ci_delete" ON storage.objects;
CREATE POLICY "app_downloads_ci_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'app-downloads');

DROP POLICY IF EXISTS "app_downloads_read_all" ON storage.objects;
CREATE POLICY "app_downloads_read_all" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'app-downloads');