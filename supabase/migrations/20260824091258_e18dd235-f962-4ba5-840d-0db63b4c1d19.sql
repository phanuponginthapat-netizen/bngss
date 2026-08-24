DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.face_scan_logs REPLICA IDENTITY FULL';
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'face_scan_logs'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.face_scan_logs';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;