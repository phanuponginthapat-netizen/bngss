
-- 1. Asset photos: remove overly-broad authenticated policies (staff-only ones already exist)
DROP POLICY IF EXISTS "Auth users can upload asset photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update asset photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete asset photos" ON storage.objects;

-- 2. Exam scans: restrict to staff roles only
DROP POLICY IF EXISTS "exam-scans authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "exam-scans authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "exam-scans authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "exam-scans authenticated delete" ON storage.objects;

DROP POLICY IF EXISTS "Staff can read exam-scans" ON storage.objects;
CREATE POLICY "Staff can read exam-scans" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'exam-scans' AND (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'director') OR
    public.has_role(auth.uid(),'teacher')
  ));

DROP POLICY IF EXISTS "Staff can insert exam-scans" ON storage.objects;
CREATE POLICY "Staff can insert exam-scans" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exam-scans' AND (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'director') OR
    public.has_role(auth.uid(),'teacher')
  ));

DROP POLICY IF EXISTS "Staff can update exam-scans" ON storage.objects;
CREATE POLICY "Staff can update exam-scans" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'exam-scans' AND (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'director') OR
    public.has_role(auth.uid(),'teacher')
  ));

DROP POLICY IF EXISTS "Staff can delete exam-scans" ON storage.objects;
CREATE POLICY "Staff can delete exam-scans" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'exam-scans' AND (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'director') OR
    public.has_role(auth.uid(),'teacher')
  ));

-- 3. pp5_files / pp6_files: restrict SELECT to staff only
DROP POLICY IF EXISTS "Auth users can view pp5_files" ON public.pp5_files;
DROP POLICY IF EXISTS "Staff can view pp5_files" ON public.pp5_files;
CREATE POLICY "Staff can view pp5_files" ON public.pp5_files
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'director') OR
    public.has_role(auth.uid(),'teacher')
  );

DROP POLICY IF EXISTS "Auth users can view pp6_files" ON public.pp6_files;
DROP POLICY IF EXISTS "Staff can view pp6_files" ON public.pp6_files;
CREATE POLICY "Staff can view pp6_files" ON public.pp6_files
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'director') OR
    public.has_role(auth.uid(),'teacher')
  );

-- 4. home-visit-photos: allow students to view photos linked to their own home_visits record
-- Convention: photo file path stored as one of the URLs in home_visits.photo_urls
DROP POLICY IF EXISTS "Students can view own home visit photos" ON storage.objects;
CREATE POLICY "Students can view own home visit photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'home-visit-photos'
    AND EXISTS (
      SELECT 1
      FROM public.home_visits hv
      JOIN public.students s ON s.id = hv.student_id
      WHERE s.auth_user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM unnest(hv.photo_urls) AS u
          WHERE u LIKE '%' || storage.objects.name
        )
    )
  );
