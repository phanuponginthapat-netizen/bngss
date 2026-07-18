ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.inbox_items REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_items;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;