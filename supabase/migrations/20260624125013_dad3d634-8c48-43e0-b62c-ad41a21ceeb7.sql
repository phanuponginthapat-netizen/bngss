ALTER TABLE public.ai_provider_keys
  DROP CONSTRAINT IF EXISTS ai_provider_keys_provider_type_check;

ALTER TABLE public.ai_provider_keys
  ADD CONSTRAINT ai_provider_keys_provider_type_check
  CHECK (provider_type IN ('openai','gemini','groq','openrouter'));