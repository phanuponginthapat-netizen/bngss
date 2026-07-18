
CREATE POLICY "Authenticated read print-templates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'print-templates');

CREATE POLICY "Admin/Director write print-templates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'print-templates' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

CREATE POLICY "Admin/Director update print-templates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'print-templates' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

CREATE POLICY "Admin/Director delete print-templates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'print-templates' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));
