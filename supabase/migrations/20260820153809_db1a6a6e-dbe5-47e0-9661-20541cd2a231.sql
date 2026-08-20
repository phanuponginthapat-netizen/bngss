-- Fix: PostgREST upsert (on_conflict=user_id,device_token) cannot use a PARTIAL
-- unique index as conflict arbiter -> 42P10. Replace with a plain unique index.
DROP INDEX IF EXISTS public.push_subscriptions_user_device_idx;
DROP INDEX IF EXISTS public.push_subscriptions_user_device_token_key;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_device_token_key
  ON public.push_subscriptions (user_id, device_token);

ALTER TABLE public.push_subscriptions
  ALTER COLUMN provider SET DEFAULT 'webpush';