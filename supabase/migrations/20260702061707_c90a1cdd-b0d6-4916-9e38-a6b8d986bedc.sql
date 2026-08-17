
CREATE TABLE IF NOT EXISTS public.browser_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  domain text NOT NULL,
  action text NOT NULL DEFAULT 'visit',
  reason text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.browser_logs TO authenticated;
GRANT ALL ON public.browser_logs TO service_role;
ALTER TABLE public.browser_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own insert" ON public.browser_logs;
DROP POLICY IF EXISTS "own insert" ON public.browser_logs;
CREATE POLICY "own insert" ON public.browser_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own select" ON public.browser_logs;
DROP POLICY IF EXISTS "own select" ON public.browser_logs;
CREATE POLICY "own select" ON public.browser_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin select all" ON public.browser_logs;
DROP POLICY IF EXISTS "admin select all" ON public.browser_logs;
CREATE POLICY "admin select all" ON public.browser_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE INDEX IF NOT EXISTS browser_logs_user_created_idx ON public.browser_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS browser_logs_domain_idx ON public.browser_logs(domain);
