ALTER TABLE public.ict_devices REPLICA IDENTITY FULL;
ALTER TABLE public.ict_loans REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ict_devices;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ict_loans;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;