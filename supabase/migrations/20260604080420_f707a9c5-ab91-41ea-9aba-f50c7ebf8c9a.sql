
-- error_logs: client + server runtime errors
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  source text NOT NULL DEFAULT 'client',
  message text NOT NULL,
  stack text,
  component_stack text,
  url text,
  user_agent text,
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.error_logs TO anon, authenticated;
GRANT SELECT, DELETE ON public.error_logs TO authenticated;
GRANT ALL ON public.error_logs TO service_role;

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert errors" ON public.error_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admins view errors" ON public.error_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE POLICY "admins delete errors" ON public.error_logs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs(created_at DESC);

-- rate_limit_logs: track abuse on edge functions
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  identifier text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.rate_limit_logs TO anon, authenticated;
GRANT SELECT ON public.rate_limit_logs TO authenticated;
GRANT ALL ON public.rate_limit_logs TO service_role;

ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service insert rate logs" ON public.rate_limit_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "admins view rate logs" ON public.rate_limit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_created ON public.rate_limit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_fn ON public.rate_limit_logs(function_name, identifier, created_at DESC);
