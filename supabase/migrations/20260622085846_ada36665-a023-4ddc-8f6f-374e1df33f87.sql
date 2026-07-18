
INSERT INTO public.ai_providers (name, provider_type, base_url, model, priority, enabled, supports_vision, supports_json, notes)
VALUES
  ('Lovable AI Gateway', 'lovable', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'google/gemini-2.5-flash', 1, true, true, true, 'ใช้ LOVABLE_API_KEY'),
  ('OpenRouter', 'openrouter', 'https://openrouter.ai/api/v1/chat/completions', 'google/gemini-2.0-flash-exp:free', 2, true, true, true, 'ใช้ OPENROUTER_API_KEY'),
  ('Groq', 'groq', 'https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile', 3, true, false, true, 'ใช้ GROQ_API_KEY'),
  ('DeepSeek', 'deepseek', 'https://api.deepseek.com/v1/chat/completions', 'deepseek-chat', 4, true, false, true, 'ใช้ DEEPSEEK_API_KEY'),
  ('Google Gemini', 'gemini', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', 'gemini-2.0-flash', 5, true, true, true, 'ใช้ GEMINI_API_KEY'),
  ('DashScope (Qwen)', 'dashscope', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', 'qwen-plus', 6, true, true, true, 'ใช้ DASHSCOPE_API_KEY')
ON CONFLICT DO NOTHING;
