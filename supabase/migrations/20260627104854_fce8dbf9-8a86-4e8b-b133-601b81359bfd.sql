
-- 1) Worksheet files: require path prefix = uploader user id
DROP POLICY IF EXISTS wsf_auth_insert ON storage.objects;
CREATE POLICY wsf_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'worksheet-files'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2) Procurement documents: uploader can read own rows
DROP POLICY IF EXISTS "Uploaders can view own proc docs" ON public.procurement_documents;
CREATE POLICY "Uploaders can view own proc docs" ON public.procurement_documents
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid());

-- 3) Social posts: only show posts that have a posted_at timestamp
DROP POLICY IF EXISTS "Public can read social posts" ON public.social_posts;
CREATE POLICY "Public can read published social posts" ON public.social_posts
  FOR SELECT TO anon, authenticated
  USING (posted_at IS NOT NULL);
