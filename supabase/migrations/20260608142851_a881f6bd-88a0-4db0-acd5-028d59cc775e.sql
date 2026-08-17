CREATE TABLE IF NOT EXISTS public.ai_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('elevenlabs','xiaozhi')),
  name text NOT NULL,
  api_key text NOT NULL,
  agent_id text,
  endpoint_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_integrations TO authenticated;
GRANT ALL ON public.ai_integrations TO service_role;

ALTER TABLE public.ai_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/director manage ai_integrations" ON public.ai_integrations;
CREATE POLICY "Admin/director manage ai_integrations"
ON public.ai_integrations FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TRIGGER trg_ai_integrations_updated
BEFORE UPDATE ON public.ai_integrations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_integrations;