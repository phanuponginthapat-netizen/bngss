DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.ai_provider_keys DROP CONSTRAINT IF EXISTS ai_provider_keys_provider_type_check';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.ai_provider_keys ADD CONSTRAINT ai_provider_keys_provider_type_check
  CHECK (provider_type IN (''openai'',''gemini'',''groq'',''openrouter'',''cerebras'',''glm'',''huggingface'',''github'',''sambanova'',''cohere'',''deepseek'',''mistral'',''together'',''xai'',''fireworks'',''nvidia'',''dashscope'',''perplexity'',''anthropic''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
