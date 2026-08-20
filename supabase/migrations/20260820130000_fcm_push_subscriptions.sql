-- FCM push support: push_subscriptions now also stores native device tokens
-- from the Android APK (@capacitor/push-notifications → Firebase Cloud Messaging).
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS device_token text,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'webpush',
  ADD COLUMN IF NOT EXISTS platform text;

-- One native device token per user (token rotates on app reinstall).
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_device_idx
  ON public.push_subscriptions (user_id, device_token)
  WHERE device_token IS NOT NULL;

COMMENT ON COLUMN public.push_subscriptions.provider IS 'webpush (PWA/browser) or fcm (Android APK)';
COMMENT ON COLUMN public.push_subscriptions.device_token IS 'FCM registration token for native Android push';