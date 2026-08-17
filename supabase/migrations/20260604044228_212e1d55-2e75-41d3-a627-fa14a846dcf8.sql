
CREATE TABLE IF NOT EXISTS public.ai_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('elevenlabs','xiaozhi')),
  name TEXT NOT NULL,
  api_key TEXT,
  agent_id TEXT,
  endpoint_url TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_integrations TO authenticated;
GRANT ALL ON public.ai_integrations TO service_role;
ALTER TABLE public.ai_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage ai integrations" ON public.ai_integrations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE TRIGGER trg_ai_integrations_updated BEFORE UPDATE ON public.ai_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
