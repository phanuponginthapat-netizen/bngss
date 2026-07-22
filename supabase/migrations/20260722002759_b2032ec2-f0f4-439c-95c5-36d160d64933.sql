
DROP POLICY IF EXISTS "Admin can upload cms images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update cms images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete cms images" ON storage.objects;
DROP POLICY IF EXISTS "CMS staff can upload cms images" ON storage.objects;
DROP POLICY IF EXISTS "CMS staff can update cms images" ON storage.objects;
DROP POLICY IF EXISTS "CMS staff can delete cms images" ON storage.objects;

CREATE POLICY "CMS staff can upload cms images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cms-images' AND (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'super_admin') OR
      public.has_role(auth.uid(), 'school_admin') OR
      public.has_role(auth.uid(), 'director')
    )
  );

CREATE POLICY "CMS staff can update cms images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'cms-images' AND (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'super_admin') OR
      public.has_role(auth.uid(), 'school_admin') OR
      public.has_role(auth.uid(), 'director')
    )
  );

CREATE POLICY "CMS staff can delete cms images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'cms-images' AND (
      public.has_role(auth.uid(), 'admin') OR
      public.has_role(auth.uid(), 'super_admin') OR
      public.has_role(auth.uid(), 'school_admin') OR
      public.has_role(auth.uid(), 'director')
    )
  );
