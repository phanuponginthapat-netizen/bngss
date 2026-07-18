-- 1) Revoke column-level SELECT on ai_provider_keys.api_key from non-service roles
REVOKE SELECT (api_key) ON public.ai_provider_keys FROM anon, authenticated;

-- 2) Drop overly-broad teacher SELECT policy on documents (recipients-scoped policy remains)
DROP POLICY IF EXISTS "Teachers view documents" ON public.documents;