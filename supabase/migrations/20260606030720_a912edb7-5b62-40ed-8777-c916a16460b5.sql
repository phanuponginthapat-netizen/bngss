
CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type TEXT NOT NULL CHECK (provider_type IN ('gemini','groq','openrouter')),
  api_key TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cooldown','disabled')),
  used_today INT NOT NULL DEFAULT 0,
  used_total BIGINT NOT NULL DEFAULT 0,
  daily_limit INT,
  cooldown_until TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  priority INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_keys TO authenticated;
GRANT ALL ON public.ai_provider_keys TO service_role;

ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai provider keys"
  ON public.ai_provider_keys
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_aipk_provider_status ON public.ai_provider_keys(provider_type, status, priority, used_today);

CREATE TRIGGER trg_aipk_updated_at
  BEFORE UPDATE ON public.ai_provider_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_provider_keys;
ALTER TABLE public.ai_provider_keys REPLICA IDENTITY FULL;
