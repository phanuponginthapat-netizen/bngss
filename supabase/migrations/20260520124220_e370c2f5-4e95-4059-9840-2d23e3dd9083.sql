ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.inbox_items REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'notifications'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
      END IF;
    END $$;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'inbox_items'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_items;
      END IF;
    END $$;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;