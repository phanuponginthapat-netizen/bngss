
INSERT INTO public.ai_providers (name, provider_type, base_url, api_key, model, priority, enabled, supports_vision, supports_json, notes)
VALUES
 ('Lovable AI Gateway', 'lovable', 'https://ai.gateway.lovable.dev/v1/chat/completions', '', 'google/gemini-2.5-flash', 1, true, true, true, 'ใช้ LOVABLE_API_KEY อัตโนมัติ — ไม่ต้องกรอก key'),
 ('Google Gemini', 'gemini', 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', '', 'gemini-2.0-flash', 2, false, true, true, 'ต้องตั้ง GEMINI_API_KEY ใน Secrets'),
 ('OpenAI', 'openai', 'https://api.openai.com/v1/chat/completions', '', 'gpt-4o-mini', 3, false, true, true, 'ต้องตั้ง OPENAI_API_KEY'),
 ('OpenRouter', 'openrouter', 'https://openrouter.ai/api/v1/chat/completions', '', 'meta-llama/llama-3.1-8b-instruct:free', 4, false, false, true, 'รวมหลายโมเดล — ตั้ง OPENROUTER_API_KEY'),
 ('Groq', 'groq', 'https://api.groq.com/openai/v1/chat/completions', '', 'llama-3.1-8b-instant', 5, false, false, true, 'เร็วมาก — ตั้ง GROQ_API_KEY'),
 ('DeepSeek', 'deepseek', 'https://api.deepseek.com/v1/chat/completions', '', 'deepseek-chat', 6, false, false, true, 'ตั้ง DEEPSEEK_API_KEY')
ON CONFLICT DO NOTHING;
