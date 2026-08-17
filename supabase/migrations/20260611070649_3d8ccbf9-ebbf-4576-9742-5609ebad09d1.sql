
-- 1) Notification preferences per user
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  in_app_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  line_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  -- per-type opt-out: {"news": false, "homework": true, ...}
  type_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- minimum severity to trigger push outside quiet hours (info|warning|critical)
  min_push_severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own prefs" ON public.notification_preferences;
CREATE POLICY "users manage own prefs" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_notif_prefs_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Delivery log
CREATE TABLE IF NOT EXISTS public.notification_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  channel text NOT NULL, -- in_app | push | line | gchat
  notification_type text,
  title text,
  status text NOT NULL, -- sent | failed | skipped
  reason text,
  reference_id uuid,
  reference_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_delivery_log TO authenticated;
GRANT ALL ON public.notification_delivery_log TO service_role;
ALTER TABLE public.notification_delivery_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin/director can read logs" ON public.notification_delivery_log;
CREATE POLICY "admin/director can read logs" ON public.notification_delivery_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE INDEX IF NOT EXISTS idx_notif_log_created ON public.notification_delivery_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_user ON public.notification_delivery_log(user_id, created_at DESC);

-- 3) Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_delivery_log;
