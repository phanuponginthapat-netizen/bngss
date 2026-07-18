
-- Add missing user-facing tables to realtime publication
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.admissions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.early_childhood_dev; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.eform_attachments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.schools; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Ensure UPDATE/DELETE payloads include old row values for high-traffic social tables
ALTER TABLE public.wall_posts REPLICA IDENTITY FULL;
ALTER TABLE public.wall_post_comments REPLICA IDENTITY FULL;
ALTER TABLE public.wall_post_reactions REPLICA IDENTITY FULL;
