ALTER TABLE public.ict_devices REPLICA IDENTITY FULL;
ALTER TABLE public.ict_loans REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'ict_devices'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ict_devices;
      END IF;
    END $$;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'ict_loans'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ict_loans;
      END IF;
    END $$;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;