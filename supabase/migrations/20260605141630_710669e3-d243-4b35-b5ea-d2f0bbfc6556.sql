
CREATE TABLE IF NOT EXISTS public.ai_user_memory (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  summary text DEFAULT '',
  facts text[] DEFAULT ARRAY[]::text[],
  preferences jsonb DEFAULT '{}'::jsonb,
  message_count integer NOT NULL DEFAULT 0,
  last_topic text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.ai_user_memory TO authenticated;
GRANT ALL ON public.ai_user_memory TO service_role;

ALTER TABLE public.ai_user_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own AI memory" ON public.ai_user_memory;
CREATE POLICY "Users manage own AI memory"
  ON public.ai_user_memory FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admin/director view all AI memory" ON public.ai_user_memory;
CREATE POLICY "Admin/director view all AI memory"
  ON public.ai_user_memory FOR SELECT
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

DROP TRIGGER IF EXISTS trg_ai_user_memory_updated_at ON public.ai_user_memory;
CREATE TRIGGER trg_ai_user_memory_updated_at
  BEFORE UPDATE ON public.ai_user_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime sync across devices
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_user_memory;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_chat_logs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.ai_chat_logs REPLICA IDENTITY FULL;
ALTER TABLE public.ai_user_memory REPLICA IDENTITY FULL;
