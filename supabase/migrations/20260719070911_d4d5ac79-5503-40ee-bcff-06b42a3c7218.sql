
-- Prune unused seeded secrets from app_secrets and rewrite defaults to only
-- include keys that are actually referenced by edge functions or the app.

DELETE FROM public.app_secrets
WHERE key IN (
  -- Never referenced in code
  'LINE_CHANNEL_SECRET','LINE_LOGIN_CHANNEL_SECRET',
  'LIFF_ID_LEAVE','LIFF_ID_ATTENDANCE',
  'GOOGLE_CHAT_DEFAULT_WEBHOOK','RESEND_API_KEY',
  -- Unused AI provider defaults (AI keys live in ai_providers tab)
  'MISTRAL_API_KEY','COHERE_API_KEY','HUGGINGFACE_API_KEY','TOGETHER_API_KEY',
  'CEREBRAS_API_KEY','SAMBANOVA_API_KEY','GLM_API_KEY','XAI_API_KEY',
  'FIREWORKS_API_KEY','NVIDIA_API_KEY','GITHUB_MODELS_TOKEN',
  'PERPLEXITY_API_KEY','ANTHROPIC_API_KEY'
) AND (value IS NULL OR value = '');

CREATE OR REPLACE FUNCTION public.ensure_default_app_secrets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_secrets (key, description, category) VALUES
    -- Auto-provisioned on remix (mirrored from env vars by sync-env-secrets)
    ('CRON_SECRET', 'ใช้ภายในสำหรับเรียก cron จาก pg_cron (auto)', 'auto'),
    ('VAPID_PUBLIC_KEY', 'Web Push VAPID Public Key (auto)', 'auto'),
    ('VAPID_PRIVATE_KEY', 'Web Push VAPID Private Key (auto)', 'auto'),
    ('VAPID_SUBJECT', 'Web Push VAPID Subject (mailto:...) (auto)', 'auto'),
    -- Facebook Page (Social Wall / social-feed-sync)
    ('FB_PAGE_ACCESS_TOKEN', 'Facebook Page Access Token (Social Wall sync)', 'social'),
    ('FB_PAGE_ID', 'Facebook Page ID (Social Wall sync)', 'social'),
    -- LINE Messaging + LIFF
    ('LINE_CHANNEL_ACCESS_TOKEN', 'LINE OA Messaging Channel Access Token', 'line'),
    ('LINE_LOGIN_CHANNEL_ID', 'LINE Login Channel ID (LIFF)', 'line'),
    ('LINE_LIFF_CHANNEL_ID', 'LIFF Channel ID', 'line'),
    -- Optional TTS
    ('ELEVENLABS_API_KEY', 'ElevenLabs TTS (ตัวเลือกเสริม)', 'notifications')
  ON CONFLICT (key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_app_secrets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_default_app_secrets() TO authenticated, service_role;

SELECT public.ensure_default_app_secrets();
