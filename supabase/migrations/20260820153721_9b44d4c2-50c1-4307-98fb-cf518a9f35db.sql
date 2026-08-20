DROP INDEX IF EXISTS public.push_subscriptions_user_device_token_key;
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_device_token_key
  ON public.push_subscriptions (user_id, device_token);