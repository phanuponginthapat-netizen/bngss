DROP POLICY IF EXISTS "profile-images owner or staff read" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_public_read" ON storage.objects;

CREATE POLICY "profile-images authenticated read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'profile-images');