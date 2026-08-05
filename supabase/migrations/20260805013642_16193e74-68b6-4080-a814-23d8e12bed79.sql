DROP POLICY IF EXISTS "documents auth read" ON storage.objects;
DROP POLICY IF EXISTS "documents auth write" ON storage.objects;

CREATE POLICY "documents staff read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND (owner = auth.uid() OR public.is_staff_user(auth.uid())));

CREATE POLICY "documents staff write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND owner = auth.uid() AND public.is_staff_user(auth.uid()));