
UPDATE public.ai_providers SET enabled = true, priority = 1 WHERE model = 'deepseek/deepseek-chat-v3.1:free';
UPDATE public.ai_providers SET enabled = true, priority = 2 WHERE model = 'qwen/qwen-2.5-72b-instruct:free';
UPDATE public.ai_providers SET enabled = true, priority = 3 WHERE model = 'qwen/qwen2.5-vl-72b-instruct:free';
UPDATE public.ai_providers SET priority = 90 WHERE model = 'google/gemini-3.5-flash' AND provider_type = 'lovable';
UPDATE public.ai_providers SET priority = 95 WHERE model = 'google/gemini-2.5-flash' AND provider_type = 'lovable';
