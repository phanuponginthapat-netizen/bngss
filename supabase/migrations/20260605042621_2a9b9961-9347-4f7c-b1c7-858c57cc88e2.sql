
-- Restrict INSERT on document-files, pa-files, pp6-files to staff
DROP POLICY IF EXISTS "Authenticated users can upload document files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload PA files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload pp6 files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own document files" ON storage.objects;

DROP POLICY IF EXISTS "Staff upload document files" ON storage.objects;
CREATE POLICY "Staff upload document files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'document-files'
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'director'::public.app_role)
      OR public.has_role(auth.uid(), 'teacher'::public.app_role))
  );

DROP POLICY IF EXISTS "Staff upload PA files" ON storage.objects;
CREATE POLICY "Staff upload PA files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pa-files'
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'director'::public.app_role)
      OR public.has_role(auth.uid(), 'teacher'::public.app_role))
  );

DROP POLICY IF EXISTS "Staff upload pp6 files" ON storage.objects;
CREATE POLICY "Staff upload pp6 files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pp6-files'
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'director'::public.app_role)
      OR public.has_role(auth.uid(), 'teacher'::public.app_role))
  );

-- Restrict UPDATE on document-files to owner or admin/director
DROP POLICY IF EXISTS "Owner or admin update document files" ON storage.objects;
CREATE POLICY "Owner or admin update document files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'document-files'
    AND (owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'director'::public.app_role))
  )
  WITH CHECK (
    bucket_id = 'document-files'
    AND (owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'director'::public.app_role))
  );
