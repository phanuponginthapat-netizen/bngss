
ALTER PUBLICATION supabase_realtime ADD TABLE public.subject_grading_config;
ALTER TABLE public.subject_grading_config REPLICA IDENTITY FULL;
