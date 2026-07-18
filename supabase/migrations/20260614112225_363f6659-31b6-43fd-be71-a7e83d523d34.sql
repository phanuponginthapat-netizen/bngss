
CREATE POLICY "Students can self-request face registration"
ON public.face_registration_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Students can upload own face photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'face-photos'
  AND (storage.foldername(name))[1] = 'requests'
  AND (storage.foldername(name))[2] IN (
    SELECT id::text FROM public.students WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Students can view own face photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'face-photos'
  AND (storage.foldername(name))[1] = 'requests'
  AND (storage.foldername(name))[2] IN (
    SELECT id::text FROM public.students WHERE auth_user_id = auth.uid()
  )
);
