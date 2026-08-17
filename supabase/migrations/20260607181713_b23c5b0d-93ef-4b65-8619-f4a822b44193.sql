DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.ai_chat_logs REPLICA IDENTITY FULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
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
