ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS device_token text,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS platform text;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_device_token_key
  ON public.push_subscriptions (user_id, device_token)
  WHERE device_token IS NOT NULL;