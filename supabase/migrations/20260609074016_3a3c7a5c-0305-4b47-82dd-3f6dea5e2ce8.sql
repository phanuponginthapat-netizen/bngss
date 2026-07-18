
CREATE POLICY "hub-projects read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hub-projects');
CREATE POLICY "hub-projects write staff" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hub-projects' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "hub-projects update staff" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'hub-projects' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "hub-projects delete staff" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hub-projects' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
