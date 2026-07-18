
-- Storage RLS: teaching-reflections bucket
CREATE POLICY "tr_files_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'teaching-reflections');

CREATE POLICY "tr_files_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'teaching-reflections' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "tr_files_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'teaching-reflections' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY "tr_files_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'teaching-reflections' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin')));
