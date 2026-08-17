
CREATE TABLE IF NOT EXISTS public.config_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  source_url TEXT,
  content JSONB NOT NULL,
  applied_at TIMESTAMPTZ,
  applied_by UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_bundles TO authenticated;
GRANT ALL ON public.config_bundles TO service_role;
ALTER TABLE public.config_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage config bundles" ON public.config_bundles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
