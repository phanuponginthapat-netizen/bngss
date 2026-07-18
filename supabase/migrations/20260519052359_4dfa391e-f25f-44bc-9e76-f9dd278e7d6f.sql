-- Conversation state for multi-step LINE flows (leave submission, etc)
CREATE TABLE IF NOT EXISTS public.line_sessions (
  line_user_id TEXT PRIMARY KEY,
  intent TEXT NOT NULL,
  step TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes')
);

ALTER TABLE public.line_sessions ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) touches this — no client access policies
CREATE POLICY "Service role only - line_sessions select"
  ON public.line_sessions FOR SELECT TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_line_sessions_expires ON public.line_sessions(expires_at);

-- Per-LINE-user notification preferences (opt-in for digest, face-scan alerts, etc)
CREATE TABLE IF NOT EXISTS public.line_user_preferences (
  line_user_id TEXT PRIMARY KEY,
  digest_enabled BOOLEAN NOT NULL DEFAULT true,
  digest_time TIME NOT NULL DEFAULT '06:30',
  face_scan_alerts BOOLEAN NOT NULL DEFAULT true,
  attendance_alerts BOOLEAN NOT NULL DEFAULT true,
  behavior_alerts BOOLEAN NOT NULL DEFAULT true,
  grade_alerts BOOLEAN NOT NULL DEFAULT true,
  news_alerts BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.line_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only - line_user_preferences select"
  ON public.line_user_preferences FOR SELECT TO authenticated USING (false);

CREATE TRIGGER update_line_user_preferences_updated_at
  BEFORE UPDATE ON public.line_user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: clean expired sessions (called by edge function as needed)
CREATE OR REPLACE FUNCTION public.cleanup_expired_line_sessions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.line_sessions WHERE expires_at < now();
$$;