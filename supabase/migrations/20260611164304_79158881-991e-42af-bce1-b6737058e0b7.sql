CREATE OR REPLACE FUNCTION public.ensure_default_app_secrets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_secrets (key, description, category) VALUES
    ('GEMINI_API_KEY', 'Google Gemini API Key (AI Studio) — สำหรับ AI parsing/ดึงข้อมูลเอกสาร', 'ai'),
    ('LOVABLE_API_KEY', 'Lovable AI Gateway key — ตั้งให้อัตโนมัติ ไม่ต้องกรอกเอง', 'ai'),
    ('FB_PAGE_ACCESS_TOKEN', 'Facebook Page Access Token (Social Wall sync)', 'social'),
    ('FB_PAGE_ID', 'Facebook Page ID (Social Wall sync)', 'social'),
    ('LINE_CHANNEL_ACCESS_TOKEN', 'LINE OA Messaging Channel Access Token', 'line'),
    ('LINE_CHANNEL_SECRET', 'LINE OA Messaging Channel Secret', 'line'),
    ('LINE_LOGIN_CHANNEL_ID', 'LINE Login Channel ID (LIFF)', 'line'),
    ('LINE_LOGIN_CHANNEL_SECRET', 'LINE Login Channel Secret (LIFF)', 'line'),
    ('LIFF_ID_LEAVE', 'LIFF ID — ฟอร์มลา', 'line'),
    ('LIFF_ID_ATTENDANCE', 'LIFF ID — เช็คชื่อ', 'line'),
    ('VAPID_PUBLIC_KEY', 'Web Push VAPID Public Key (PWA notifications)', 'push'),
    ('VAPID_PRIVATE_KEY', 'Web Push VAPID Private Key (PWA notifications)', 'push'),
    ('VAPID_SUBJECT', 'Web Push VAPID Subject (mailto:admin@school.ac.th)', 'push'),
    ('GOOGLE_CHAT_DEFAULT_WEBHOOK', 'Default Google Chat Webhook URL — รับแจ้งเตือนระบบ', 'notifications'),
    ('RESEND_API_KEY', 'Resend API Key — ส่งอีเมล transactional', 'notifications'),
    ('OPENAI_API_KEY', 'OpenAI API Key — สำรอง AI provider', 'ai'),
    ('ANTHROPIC_API_KEY', 'Anthropic Claude API Key — สำรอง AI provider', 'ai')
  ON CONFLICT (key) DO NOTHING;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.ensure_default_app_secrets() TO authenticated, service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Run once now so existing project gets all defaults immediately
SELECT public.ensure_default_app_secrets();
