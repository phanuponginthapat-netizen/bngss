
-- 1. google_chat_webhooks: add restrictive SELECT (admin/director only)
CREATE POLICY "Admins view webhooks"
ON public.google_chat_webhooks
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Ensure google_chat_webhooks not in realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='google_chat_webhooks') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.google_chat_webhooks';
  END IF;
END $$;

-- 2. alumni_university: drop observer access
DROP POLICY IF EXISTS "Observers can view" ON public.alumni_university;

-- 3. cctv_cameras: remove from realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.cctv_cameras;

-- 4. fitness_food_logs + fitness_exercise_logs: drop observer access
DROP POLICY IF EXISTS "Observers can view" ON public.fitness_food_logs;
DROP POLICY IF EXISTS "Observers can view" ON public.fitness_exercise_logs;

-- 5. fitness_profiles: drop observer access
DROP POLICY IF EXISTS "Observers can view" ON public.fitness_profiles;

-- 6. visitor_logs: remove from realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.visitor_logs;

-- 7. procurement_advances: drop observer access
DROP POLICY IF EXISTS "Observers can view" ON public.procurement_advances;
