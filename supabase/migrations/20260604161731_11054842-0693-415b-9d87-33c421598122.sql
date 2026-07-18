
-- 1) Remove sensitive tables from realtime publication
DO $$
DECLARE
  t text;
  sensitive text[] := ARRAY[
    'salary_records','pa_agreements','pa_indicator_scores','staff_evaluations',
    'personnel_assessments','ai_providers','sdq_records','home_visits',
    'student_screenings','student_subsidies','health_records','health_measurements',
    'procurement_records','budget_transactions','account_balances',
    'google_chat_webhooks','admissions','app_secrets','district_api_keys',
    'early_childhood_dev','vaccine_records'
  ];
BEGIN
  FOREACH t IN ARRAY sensitive LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- 2) document-files: only owner/recipient/admin/director
DROP POLICY IF EXISTS "Authenticated users can read document files" ON storage.objects;
CREATE POLICY "Document owners or recipients can read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'document-files'
  AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')
    OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE storage.objects.name LIKE '%' || d.id::text || '%'
        AND (d.created_by = auth.uid() OR public.is_document_recipient(d.id, auth.uid()))
    )
  )
);

-- 3) exam-scans: staff only
DROP POLICY IF EXISTS "Authenticated users can read exam scans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload exam scans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update exam scans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete exam scans" ON storage.objects;
CREATE POLICY "Staff can read exam scans" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'exam-scans' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "Staff can write exam scans" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exam-scans' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "Staff can update exam scans" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'exam-scans' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "Staff can delete exam scans" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'exam-scans' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));

-- 4) asset-photos: staff only write
DROP POLICY IF EXISTS "Authenticated users can upload asset photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update asset photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete asset photos" ON storage.objects;
CREATE POLICY "Staff write asset photos ins" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'asset-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "Staff write asset photos upd" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'asset-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "Staff write asset photos del" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'asset-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));

-- 5) home-visit-photos: staff only INSERT
DROP POLICY IF EXISTS "Authenticated users can upload home visit photos" ON storage.objects;
CREATE POLICY "Staff upload home visit photos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'home-visit-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));

-- 6) pp5-files: staff only upload
DROP POLICY IF EXISTS "Auth users can upload pp5 files" ON storage.objects;
CREATE POLICY "Staff upload pp5 files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pp5-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
