
-- home-visit-photos
DROP POLICY IF EXISTS "home-visit staff upload" ON storage.objects;
CREATE POLICY "home-visit staff upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'home-visit-photos' AND public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "home-visit staff read" ON storage.objects;
CREATE POLICY "home-visit staff read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'home-visit-photos' AND (owner = auth.uid() OR public.is_staff_user(auth.uid())));
DROP POLICY IF EXISTS "home-visit owner delete" ON storage.objects;
CREATE POLICY "home-visit owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'home-visit-photos' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

-- substitute-proof
DROP POLICY IF EXISTS "substitute staff upload" ON storage.objects;
CREATE POLICY "substitute staff upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'substitute-proof' AND public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "substitute staff read" ON storage.objects;
CREATE POLICY "substitute staff read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'substitute-proof' AND public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "substitute owner delete" ON storage.objects;
CREATE POLICY "substitute owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'substitute-proof' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));

-- pa-files
DROP POLICY IF EXISTS "pa-files owner upload" ON storage.objects;
CREATE POLICY "pa-files owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pa-files'
    AND public.is_staff_user(auth.uid())
    AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.has_role(auth.uid(),'admin'))
  );
DROP POLICY IF EXISTS "pa-files owner read" ON storage.objects;
CREATE POLICY "pa-files owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pa-files'
    AND ((storage.foldername(name))[1] = (auth.uid())::text
         OR public.has_role(auth.uid(),'admin')
         OR public.has_role(auth.uid(),'director'))
  );
DROP POLICY IF EXISTS "pa-files owner delete" ON storage.objects;
CREATE POLICY "pa-files owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pa-files' AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.has_role(auth.uid(),'admin')));
DROP POLICY IF EXISTS "pa-files owner update" ON storage.objects;
CREATE POLICY "pa-files owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'pa-files' AND ((storage.foldername(name))[1] = (auth.uid())::text OR public.has_role(auth.uid(),'admin')));

-- exam-scans
DROP POLICY IF EXISTS "exam-scans staff upload" ON storage.objects;
CREATE POLICY "exam-scans staff upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exam-scans' AND public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "exam-scans staff read" ON storage.objects;
CREATE POLICY "exam-scans staff read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'exam-scans' AND (owner = auth.uid() OR public.is_staff_user(auth.uid())));
DROP POLICY IF EXISTS "exam-scans owner delete" ON storage.objects;
CREATE POLICY "exam-scans owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'exam-scans' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));

-- hub-projects
DROP POLICY IF EXISTS "hub-projects staff upload" ON storage.objects;
CREATE POLICY "hub-projects staff upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hub-projects' AND public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "hub-projects owner delete" ON storage.objects;
CREATE POLICY "hub-projects owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'hub-projects' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));

-- line-vault
DROP POLICY IF EXISTS "line-vault auth upload" ON storage.objects;
CREATE POLICY "line-vault auth upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'line-vault');
DROP POLICY IF EXISTS "line-vault owner delete" ON storage.objects;
CREATE POLICY "line-vault owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'line-vault' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));

-- attendance-photos
DROP POLICY IF EXISTS "attendance-photos auth upload" ON storage.objects;
CREATE POLICY "attendance-photos auth upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'attendance-photos');
DROP POLICY IF EXISTS "attendance-photos owner read" ON storage.objects;
CREATE POLICY "attendance-photos owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'attendance-photos' AND (owner = auth.uid() OR public.is_staff_user(auth.uid())));
