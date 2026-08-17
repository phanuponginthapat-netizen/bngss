ALTER TABLE public.ai_chat_logs REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ai_chat_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_chat_logs;
  END IF;
END $$;