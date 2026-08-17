DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.ict_devices REPLICA IDENTITY FULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.ict_loans REPLICA IDENTITY FULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $$ BEGIN
  BEGIN
          IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'ict_devices'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ict_devices;
      END IF;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
          IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'ict_loans'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ict_loans;
      END IF;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
