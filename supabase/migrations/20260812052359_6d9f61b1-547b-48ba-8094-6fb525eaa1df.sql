CREATE POLICY "Students can upload their own face request photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'face-photos'
  AND name LIKE 'requests/%/%'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id::text = split_part(name, '/', 2)
      AND s.auth_user_id = auth.uid()
  )
);

CREATE POLICY "Students can view their own face request photos" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'face-photos'
  AND name LIKE 'requests/%/%'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id::text = split_part(name, '/', 2)
      AND s.auth_user_id = auth.uid()
  )
);
