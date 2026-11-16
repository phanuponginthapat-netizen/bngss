CREATE POLICY "Students view own scan photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'face-photos'
  AND (storage.foldername(name))[1] = 'scans'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.auth_user_id = auth.uid()
      AND position(s.id::text in storage.objects.name) > 0
  )
);

CREATE POLICY "Parents view child scan photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'face-photos'
  AND (storage.foldername(name))[1] = 'scans'
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE public.is_parent_of(auth.uid(), s.id)
      AND position(s.id::text in storage.objects.name) > 0
  )
);