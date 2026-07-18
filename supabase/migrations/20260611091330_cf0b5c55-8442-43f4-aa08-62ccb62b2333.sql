
-- Lock sensitive columns from client (authenticated/anon) — only service_role can SELECT
REVOKE SELECT (api_key) ON public.ai_provider_keys FROM authenticated;
REVOKE SELECT (api_key) ON public.ai_providers FROM authenticated;
REVOKE SELECT (value) ON public.app_secrets FROM authenticated;
REVOKE SELECT (webhook_url) ON public.google_chat_webhooks FROM authenticated;

-- Safe metadata views for admin UI
CREATE OR REPLACE VIEW public.app_secrets_meta
WITH (security_invoker = on) AS
SELECT key, description, category, updated_at, updated_by,
       (value IS NOT NULL AND length(value) > 0) AS has_value
FROM public.app_secrets;
GRANT SELECT ON public.app_secrets_meta TO authenticated;

CREATE OR REPLACE VIEW public.google_chat_webhooks_meta
WITH (security_invoker = on) AS
SELECT id, department, webhook_name, is_active, notification_types,
       custom_messages, created_at, updated_at,
       (webhook_url IS NOT NULL AND length(webhook_url) > 0) AS has_url
FROM public.google_chat_webhooks;
GRANT SELECT ON public.google_chat_webhooks_meta TO authenticated;

CREATE OR REPLACE VIEW public.ai_providers_meta
WITH (security_invoker = on) AS
SELECT id, name, provider_type, base_url, model, priority, enabled,
       supports_vision, supports_json, monthly_call_limit, extra_headers, notes,
       created_at, updated_at,
       (api_key IS NOT NULL AND length(api_key) > 0) AS has_key
FROM public.ai_providers;
GRANT SELECT ON public.ai_providers_meta TO authenticated;

CREATE OR REPLACE VIEW public.ai_provider_keys_meta
WITH (security_invoker = on) AS
SELECT id, provider_type, label, status, used_today, used_total,
       daily_limit, cooldown_until, last_used_at, last_error,
       last_reset_date, priority, created_at, updated_at,
       (api_key IS NOT NULL AND length(api_key) > 0) AS has_key
FROM public.ai_provider_keys;
GRANT SELECT ON public.ai_provider_keys_meta TO authenticated;
