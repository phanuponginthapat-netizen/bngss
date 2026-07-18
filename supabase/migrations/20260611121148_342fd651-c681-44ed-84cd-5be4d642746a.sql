
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'salary_records','audit_logs','pdpa_consents','student_subsidies',
    'student_screenings','home_visits','staff_evaluations','pa_agreements',
    'pa_indicator_scores','procurement_records','budget_transactions',
    'account_balances','student_face_descriptors'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t AND schemaname = 'public'
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END$$;
