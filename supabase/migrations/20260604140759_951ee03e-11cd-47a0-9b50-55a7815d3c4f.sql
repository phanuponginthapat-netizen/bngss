
DROP POLICY IF EXISTS "Authenticated can view asset photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view cms images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view garbage images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view pp5 files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "ICT photos public read" ON storage.objects;

-- จำกัด list ให้เฉพาะเจ้าของไฟล์หรือ admin/director (อ่านผ่าน public URL ยังทำได้)
DROP POLICY IF EXISTS "Owner or admin can list public buckets" ON storage.objects;
CREATE POLICY "Owner or admin can list public buckets"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('asset-photos','cms-images','garbage-images','ict-loan-photos','pp5-files','profile-images')
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'director'::public.app_role)
    )
  );
