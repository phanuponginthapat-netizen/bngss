ALTER TABLE public.ai_chat_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_chat_logs;