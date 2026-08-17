
DROP POLICY IF EXISTS "students upload own homework" ON storage.objects;
DROP POLICY IF EXISTS "students read own homework" ON storage.objects;
DROP POLICY IF EXISTS "students delete own homework" ON storage.objects;

DROP POLICY IF EXISTS "students upload own homework" ON storage.objects;
CREATE POLICY "students upload own homework"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'homework' AND (storage.foldername(name))[2] = auth.uid()::text);

DROP POLICY IF EXISTS "students read own homework" ON storage.objects;
CREATE POLICY "students read own homework"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'homework' AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR public.has_role(auth.uid(), 'teacher'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  )
);

DROP POLICY IF EXISTS "students delete own homework" ON storage.objects;
CREATE POLICY "students delete own homework"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'homework' AND (storage.foldername(name))[2] = auth.uid()::text);
