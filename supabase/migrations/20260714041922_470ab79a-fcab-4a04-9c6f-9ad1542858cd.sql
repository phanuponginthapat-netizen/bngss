CREATE POLICY "admin manage line-richmenu"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'line-richmenu' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')))
WITH CHECK (bucket_id = 'line-richmenu' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')));
