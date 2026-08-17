UPDATE public.ai_providers SET model='google/gemini-2.0-flash-exp:free', name='OpenRouter Free - Gemini 2.0 Flash', supports_vision=true, priority=1
  WHERE id='813f079f-eada-4c3f-a555-6041aceb0238';
UPDATE public.ai_providers SET model='meta-llama/llama-3.2-11b-vision-instruct:free', name='OpenRouter Free - Llama 3.2 Vision', supports_vision=true, priority=2
  WHERE id='2a15f563-6bd6-4544-92d5-c259ebd21661';
UPDATE public.ai_providers SET model='deepseek/deepseek-r1:free', name='OpenRouter Free - DeepSeek R1', supports_vision=false, priority=3
  WHERE id='e333e2a8-c41c-460b-961a-4862e9a231ac';
