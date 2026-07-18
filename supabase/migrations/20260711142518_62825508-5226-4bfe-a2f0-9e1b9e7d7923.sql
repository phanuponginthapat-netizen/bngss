
ALTER TABLE public.personnel REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.personnel;
