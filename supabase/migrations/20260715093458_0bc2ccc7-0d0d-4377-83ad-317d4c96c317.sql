CREATE OR REPLACE FUNCTION public.ensure_default_app_secrets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_secrets (key, description, category) VALUES
    ('LOVABLE_API_KEY', 'Lovable AI Gateway (Gemini/GPT ฟรีในตัว) — ตั้งอัตโนมัติ', 'ai'),
    ('GEMINI_API_KEY', 'Google Gemini (AI Studio) — ฟรี 1500 req/day', 'ai'),
    ('GROQ_API_KEY', 'Groq — ฟรี, เร็วมาก (Llama 3, Mixtral, Gemma)', 'ai'),
    ('OPENROUTER_API_KEY', 'OpenRouter — รวมหลาย model มีตัวฟรี (:free suffix)', 'ai'),
    ('DEEPSEEK_API_KEY', 'DeepSeek — ราคาถูกมาก มี free credits', 'ai'),
    ('MISTRAL_API_KEY', 'Mistral AI — ฟรี tier (La Plateforme)', 'ai'),
    ('COHERE_API_KEY', 'Cohere — ฟรี trial key ไม่จำกัดเวลา (rate limit)', 'ai'),
    ('HUGGINGFACE_API_KEY', 'Hugging Face Inference — ฟรี (open models)', 'ai'),
    ('TOGETHER_API_KEY', 'Together AI — free credits', 'ai'),
    ('CEREBRAS_API_KEY', 'Cerebras — ฟรี, เร็วที่สุด (Llama 3.1)', 'ai'),
    ('SAMBANOVA_API_KEY', 'SambaNova Cloud — ฟรี tier', 'ai'),
    ('GLM_API_KEY', 'ZhipuAI GLM-4-Flash — ฟรีถาวร', 'ai'),
    ('DASHSCOPE_API_KEY', 'Alibaba Qwen (DashScope) — ฟรี credits', 'ai'),
    ('XAI_API_KEY', 'xAI Grok — free credits', 'ai'),
    ('FIREWORKS_API_KEY', 'Fireworks AI — free credits', 'ai'),
    ('NVIDIA_API_KEY', 'NVIDIA NIM — ฟรี 1000 credits', 'ai'),
    ('GITHUB_MODELS_TOKEN', 'GitHub Models — ฟรี (ใช้ PAT)', 'ai'),
    ('PERPLEXITY_API_KEY', 'Perplexity Sonar — free tier + web search', 'ai'),
    ('OPENAI_API_KEY', 'OpenAI — paid (สำรอง)', 'ai'),
    ('ANTHROPIC_API_KEY', 'Anthropic Claude — paid (สำรอง)', 'ai'),
    ('FB_PAGE_ACCESS_TOKEN', 'Facebook Page Access Token (Social Wall sync)', 'social'),
    ('FB_PAGE_ID', 'Facebook Page ID (Social Wall sync)', 'social'),
    ('LINE_CHANNEL_ACCESS_TOKEN', 'LINE OA Messaging Channel Access Token', 'line'),
    ('LINE_CHANNEL_SECRET', 'LINE OA Messaging Channel Secret', 'line'),
    ('LINE_LOGIN_CHANNEL_ID', 'LINE Login Channel ID (LIFF)', 'line'),
    ('LINE_LOGIN_CHANNEL_SECRET', 'LINE Login Channel Secret (LIFF)', 'line'),
    ('LIFF_ID_LEAVE', 'LIFF ID — ฟอร์มลา', 'line'),
    ('LIFF_ID_ATTENDANCE', 'LIFF ID — เช็คชื่อ', 'line'),
    ('VAPID_PUBLIC_KEY', 'Web Push VAPID Public Key', 'push'),
    ('VAPID_PRIVATE_KEY', 'Web Push VAPID Private Key', 'push'),
    ('VAPID_SUBJECT', 'Web Push VAPID Subject (mailto:...)', 'push'),
    ('GOOGLE_CHAT_DEFAULT_WEBHOOK', 'Default Google Chat Webhook URL', 'notifications'),
    ('RESEND_API_KEY', 'Resend API Key — ส่งอีเมล transactional', 'notifications')
  ON CONFLICT (key) DO NOTHING;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.ensure_default_app_secrets() FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.ensure_default_app_secrets() TO authenticated, service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
SELECT public.ensure_default_app_secrets();
