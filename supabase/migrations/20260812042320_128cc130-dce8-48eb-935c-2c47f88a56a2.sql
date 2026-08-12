DROP POLICY IF EXISTS "Staff can upload face photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view face photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update face photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete face photos" ON storage.objects;

CREATE POLICY "Staff can upload face photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'face-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));

CREATE POLICY "Staff can view face photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'face-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));

CREATE POLICY "Staff can update face photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'face-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')))
WITH CHECK (bucket_id = 'face-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));

CREATE POLICY "Staff can delete face photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'face-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));