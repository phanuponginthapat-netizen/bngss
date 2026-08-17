DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'face_scan_logs','student_leaves','staff_leaves','social_posts',
    'health_records','health_measurements','vaccine_records',
    'student_scores','student_assessment_scores','student_screenings',
    'exams','exam_submissions','sdq_records','home_visits'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname=t AND relnamespace='public'::regnamespace)
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
