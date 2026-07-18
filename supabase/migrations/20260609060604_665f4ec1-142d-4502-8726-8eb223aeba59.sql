REVOKE SELECT (api_key) ON public.ai_providers FROM authenticated, anon;
REVOKE SELECT (webhook_url) ON public.google_chat_webhooks FROM authenticated, anon;