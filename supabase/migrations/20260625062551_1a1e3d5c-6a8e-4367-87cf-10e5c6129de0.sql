CREATE POLICY "Signatures readable by authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'signatures');

CREATE POLICY "Admin/director upload signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signatures'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
);

CREATE POLICY "Admin/director update signatures"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
);

CREATE POLICY "Admin/director delete signatures"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
);