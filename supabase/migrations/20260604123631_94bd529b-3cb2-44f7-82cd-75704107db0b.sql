
UPDATE public.ai_providers
SET model = 'deepseek/deepseek-chat-v3-0324:free', name = 'OpenRouter - DeepSeek V3 (free)', enabled = true, priority = 1, supports_vision = false, supports_json = true
WHERE model = 'deepseek/deepseek-chat-v3.1:free';

UPDATE public.ai_providers
SET model = 'meta-llama/llama-3.3-70b-instruct:free', name = 'OpenRouter - Llama 3.3 70B (free)', enabled = true, priority = 2, supports_vision = false, supports_json = true
WHERE model = 'qwen/qwen-2.5-72b-instruct:free';

UPDATE public.ai_providers
SET model = 'google/gemini-2.0-flash-exp:free', name = 'OpenRouter - Gemini 2.0 Flash (free, vision)', enabled = true, priority = 3, supports_vision = true, supports_json = true
WHERE model = 'qwen/qwen2.5-vl-72b-instruct:free';
