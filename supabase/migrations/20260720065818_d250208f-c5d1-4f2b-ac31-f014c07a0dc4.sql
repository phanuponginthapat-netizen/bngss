ALTER TABLE public.padlet_notes REPLICA IDENTITY FULL;
ALTER TABLE public.padlet_boards REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.padlet_notes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.padlet_boards; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;