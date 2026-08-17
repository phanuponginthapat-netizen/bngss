
DROP POLICY IF EXISTS "Authenticated read print-templates" ON storage.objects;
CREATE POLICY "Authenticated read print-templates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'print-templates');

DROP POLICY IF EXISTS "Admin/Director write print-templates" ON storage.objects;
CREATE POLICY "Admin/Director write print-templates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'print-templates' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

DROP POLICY IF EXISTS "Admin/Director update print-templates" ON storage.objects;
CREATE POLICY "Admin/Director update print-templates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'print-templates' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

DROP POLICY IF EXISTS "Admin/Director delete print-templates" ON storage.objects;
CREATE POLICY "Admin/Director delete print-templates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'print-templates' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));
