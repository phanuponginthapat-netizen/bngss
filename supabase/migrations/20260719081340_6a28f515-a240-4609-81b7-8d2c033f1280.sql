-- Remove public read policies on profile-images bucket
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "profile_images_public_read" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Owner or admin can list public buckets" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Ensure owner/staff-only read exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='profile-images owner or staff read'
  ) THEN
    CREATE POLICY "profile-images owner or staff read"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'profile-images'
        AND (
          owner = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'teacher')
          OR public.has_role(auth.uid(), 'personnel')
        )
      );
  END IF;
END $$;
