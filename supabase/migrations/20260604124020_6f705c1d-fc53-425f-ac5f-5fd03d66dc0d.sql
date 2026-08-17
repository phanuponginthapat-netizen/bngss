UPDATE public.ai_providers
SET model = 'deepseek/deepseek-chat', name = 'OpenRouter - DeepSeek V3 Chat', priority = 1, supports_vision = false
WHERE model = 'deepseek/deepseek-chat-v3-0324:free';
UPDATE public.ai_providers
SET model = 'google/gemini-flash-1.5-8b', name = 'OpenRouter - Gemini Flash 1.5 8B', priority = 2, supports_vision = true
WHERE model = 'meta-llama/llama-3.3-70b-instruct:free';
UPDATE public.ai_providers
SET model = 'meta-llama/llama-3.3-70b-instruct:free', name = 'OpenRouter - Llama 3.3 70B (free fallback)', priority = 3, supports_vision = false
WHERE model = 'google/gemini-2.0-flash-exp:free';
