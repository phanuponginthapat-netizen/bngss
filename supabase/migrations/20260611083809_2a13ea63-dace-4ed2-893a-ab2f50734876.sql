DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'task_assignments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignments';
  END IF;
END $$;
ALTER TABLE public.task_assignments REPLICA IDENTITY FULL;