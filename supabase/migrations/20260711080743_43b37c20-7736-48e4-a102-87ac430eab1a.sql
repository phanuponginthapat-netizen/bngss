-- signatures bucket: staff-only read
DROP POLICY IF EXISTS "Signatures readable by authenticated" ON storage.objects;
CREATE POLICY "Signatures readable by staff"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'signatures'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  )
);

-- homework-files bucket: owner or staff only
DROP POLICY IF EXISTS "Authenticated can read homework files" ON storage.objects;
CREATE POLICY "Owners and staff can read homework files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'homework-files'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  )
);

-- pdf-templates bucket: admin/director only
DROP POLICY IF EXISTS "authenticated read pdf-templates" ON storage.objects;
CREATE POLICY "admin director read pdf-templates"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pdf-templates'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  )
);