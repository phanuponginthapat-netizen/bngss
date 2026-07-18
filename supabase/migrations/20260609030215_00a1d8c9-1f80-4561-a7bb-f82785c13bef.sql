
CREATE POLICY "authenticated read leave-attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'leave-attachments');

CREATE POLICY "authenticated upload leave-attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'leave-attachments');

CREATE POLICY "authenticated update leave-attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'leave-attachments');

CREATE POLICY "authenticated delete leave-attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'leave-attachments');
