
-- Allow public read of profile-images so legacy stored public URLs keep working
DROP POLICY IF EXISTS "profile_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_public_read" ON storage.objects;
CREATE POLICY "profile_images_public_read" ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-images');

-- Upload/update/delete stays restricted (user can only write to own folder)
DROP POLICY IF EXISTS "profile_images_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_owner_write" ON storage.objects;
CREATE POLICY "profile_images_owner_write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-images'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_director())
);

DROP POLICY IF EXISTS "profile_images_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_owner_update" ON storage.objects;
CREATE POLICY "profile_images_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_director())
);

DROP POLICY IF EXISTS "profile_images_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "profile_images_owner_delete" ON storage.objects;
CREATE POLICY "profile_images_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-images'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin_or_director())
);
