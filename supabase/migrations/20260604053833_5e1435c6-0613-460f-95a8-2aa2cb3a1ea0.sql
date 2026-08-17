
DROP POLICY IF EXISTS "exam-scans authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "exam-scans authenticated read" ON storage.objects;
CREATE POLICY "exam-scans authenticated read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exam-scans');
DROP POLICY IF EXISTS "exam-scans authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "exam-scans authenticated insert" ON storage.objects;
CREATE POLICY "exam-scans authenticated insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exam-scans');
DROP POLICY IF EXISTS "exam-scans authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "exam-scans authenticated update" ON storage.objects;
CREATE POLICY "exam-scans authenticated update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'exam-scans');
DROP POLICY IF EXISTS "exam-scans authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "exam-scans authenticated delete" ON storage.objects;
CREATE POLICY "exam-scans authenticated delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'exam-scans');
