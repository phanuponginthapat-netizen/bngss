
CREATE TABLE IF NOT EXISTS public.app_secrets (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_secrets TO authenticated;
GRANT ALL ON public.app_secrets TO service_role;
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage app secrets" ON public.app_secrets;
CREATE POLICY "admins manage app secrets" ON public.app_secrets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE OR REPLACE FUNCTION public.get_app_secret(_key TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.app_secrets WHERE key = _key;
$$;
REVOKE EXECUTE ON FUNCTION public.get_app_secret(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_secret(TEXT) TO service_role;

INSERT INTO public.app_secrets (key, description, category) VALUES
  ('GEMINI_API_KEY', 'Google Gemini API Key (AI Studio)', 'ai'),
  ('ELEVENLABS_API_KEY', 'ElevenLabs Conversational AI', 'ai'),
  ('ELEVENLABS_AGENT_ID', 'ElevenLabs Agent ID', 'ai'),
  ('XIAOZHI_WS_URL', 'Xiaozhi WebSocket Endpoint', 'ai'),
  ('XIAOZHI_TOKEN', 'Xiaozhi Auth Token', 'ai'),
  ('FB_PAGE_ACCESS_TOKEN', 'Facebook Page Access Token (Social Wall)', 'social'),
  ('LINE_CHANNEL_ACCESS_TOKEN', 'LINE OA Channel Access Token', 'line'),
  ('LINE_CHANNEL_SECRET', 'LINE OA Channel Secret', 'line'),
  ('VAPID_PUBLIC_KEY', 'Web Push VAPID Public Key', 'push'),
  ('VAPID_PRIVATE_KEY', 'Web Push VAPID Private Key', 'push'),
  ('GOOGLE_CHAT_DEFAULT_WEBHOOK', 'Default Google Chat Webhook URL', 'notifications')
ON CONFLICT (key) DO NOTHING;
