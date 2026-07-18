
-- Staff สามารถอัป/แก้/ลบไฟล์ใน bucket learning-content
CREATE POLICY "learn_storage_insert_staff" ON storage.objects FOR INSERT
TO authenticated WITH CHECK (
  bucket_id = 'learning-content' AND (
    public.has_role(auth.uid(),'teacher')
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'director')
  )
);
CREATE POLICY "learn_storage_update_staff" ON storage.objects FOR UPDATE
TO authenticated USING (
  bucket_id = 'learning-content' AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'director')
  )
);
CREATE POLICY "learn_storage_delete_staff" ON storage.objects FOR DELETE
TO authenticated USING (
  bucket_id = 'learning-content' AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'director')
  )
);
CREATE POLICY "learn_storage_select_auth" ON storage.objects FOR SELECT
TO authenticated USING (bucket_id = 'learning-content');
