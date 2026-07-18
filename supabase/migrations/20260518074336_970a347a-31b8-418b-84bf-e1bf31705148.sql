CREATE TABLE public.user_dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  size TEXT NOT NULL DEFAULT 'medium',
  color_theme TEXT NOT NULL DEFAULT 'primary',
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, widget_key)
);

ALTER TABLE public.user_dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own widgets" ON public.user_dashboard_widgets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own widgets" ON public.user_dashboard_widgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own widgets" ON public.user_dashboard_widgets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own widgets" ON public.user_dashboard_widgets
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_dashboard_widgets_updated_at
  BEFORE UPDATE ON public.user_dashboard_widgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_dashboard_widgets_user ON public.user_dashboard_widgets(user_id, position);