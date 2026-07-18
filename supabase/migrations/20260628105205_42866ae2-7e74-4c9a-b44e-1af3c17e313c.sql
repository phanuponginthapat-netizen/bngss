CREATE POLICY "Staff read saraban files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'saraban-files' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'director'::public.app_role)
  OR public.has_role(auth.uid(), 'teacher'::public.app_role)
));
CREATE POLICY "Staff upload saraban files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'saraban-files' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'director'::public.app_role)
  OR public.has_role(auth.uid(), 'teacher'::public.app_role)
));
CREATE POLICY "Staff update saraban files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'saraban-files' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'director'::public.app_role)
  OR public.has_role(auth.uid(), 'teacher'::public.app_role)
));
CREATE POLICY "Staff delete saraban files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'saraban-files' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'director'::public.app_role)
));