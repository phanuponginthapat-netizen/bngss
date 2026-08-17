-- Add missing tables to realtime publication so UI updates without refresh
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='students') THEN
          IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'students'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
      END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='home_visit_summaries') THEN
          IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'home_visit_summaries'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.home_visit_summaries;
      END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='vaccine_records') THEN
          IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'vaccine_records'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.vaccine_records;
      END IF;
  END IF;
END $$;
-- Ensure full row payload on realtime for these tables (needed for UPDATE/DELETE payload.old)
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.students REPLICA IDENTITY FULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.home_visit_summaries REPLICA IDENTITY FULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.vaccine_records REPLICA IDENTITY FULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
