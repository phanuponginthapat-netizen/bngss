-- AI Providers (managed by admin)
CREATE TABLE IF NOT EXISTS public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'openai_compatible',
  base_url text NOT NULL,
  api_key text,
  model text NOT NULL,
  priority int NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  supports_vision boolean NOT NULL DEFAULT false,
  supports_json boolean NOT NULL DEFAULT true,
  monthly_call_limit int,
  extra_headers jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/director manage ai_providers" ON public.ai_providers;
CREATE POLICY "Admin/director manage ai_providers"
  ON public.ai_providers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

DROP TRIGGER IF EXISTS trg_ai_providers_updated ON public.ai_providers;
CREATE TRIGGER trg_ai_providers_updated
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI Usage Logs
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  provider_name text,
  model text,
  function_name text,
  tokens_input int DEFAULT 0,
  tokens_output int DEFAULT 0,
  estimated_cost numeric(10,6) DEFAULT 0,
  success boolean DEFAULT true,
  error_message text,
  latency_ms int,
  called_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/director read ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "Admin/director read ai_usage_logs"
  ON public.ai_usage_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

DROP POLICY IF EXISTS "Service role inserts logs" ON public.ai_usage_logs;
CREATE POLICY "Service role inserts logs"
  ON public.ai_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON public.ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider ON public.ai_usage_logs(provider_id, created_at DESC);

-- Seed default providers (Lovable enabled; others need API key from admin)
INSERT INTO public.ai_providers (name, provider_type, base_url, model, priority, enabled, supports_vision, notes)
VALUES
  ('Lovable AI - Gemini 3.5 Flash', 'lovable', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'google/gemini-3.5-flash', 10, true, false, 'ใช้ LOVABLE_API_KEY จาก env (ไม่ต้องกรอก api_key)'),
  ('Lovable AI - Gemini 2.5 Flash (Vision)', 'lovable', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'google/gemini-2.5-flash', 20, true, true, 'สำหรับ OCR/Vision'),
  ('OpenRouter - DeepSeek (free)', 'openrouter', 'https://openrouter.ai/api/v1/chat/completions', 'deepseek/deepseek-chat-v3.1:free', 50, false, false, 'กรอก OpenRouter API Key เพื่อเปิดใช้งาน'),
  ('OpenRouter - Qwen 2.5 72B (free)', 'openrouter', 'https://openrouter.ai/api/v1/chat/completions', 'qwen/qwen-2.5-72b-instruct:free', 60, false, false, 'กรอก OpenRouter API Key เพื่อเปิดใช้งาน'),
  ('OpenRouter - Qwen VL 72B (Vision, free)', 'openrouter', 'https://openrouter.ai/api/v1/chat/completions', 'qwen/qwen2.5-vl-72b-instruct:free', 70, false, true, 'Vision สำรอง');