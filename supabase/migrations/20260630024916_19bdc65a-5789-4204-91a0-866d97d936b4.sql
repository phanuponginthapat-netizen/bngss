
-- RLS for mou-files bucket: authenticated users (staff) can manage
CREATE POLICY "mou_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mou-files');
CREATE POLICY "mou_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mou-files');
CREATE POLICY "mou_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'mou-files');
CREATE POLICY "mou_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'mou-files'
    AND ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'director'))));
