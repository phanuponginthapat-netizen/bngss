
CREATE TABLE IF NOT EXISTS public.mascot_advice_cache (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_snapshot jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  next_refresh_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

GRANT SELECT ON public.mascot_advice_cache TO authenticated;
GRANT ALL ON public.mascot_advice_cache TO service_role;

ALTER TABLE public.mascot_advice_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own mascot cache" ON public.mascot_advice_cache;
CREATE POLICY "Users read own mascot cache"
  ON public.mascot_advice_cache
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_mascot_cache_refresh ON public.mascot_advice_cache (next_refresh_at);
