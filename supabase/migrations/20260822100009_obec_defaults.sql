-- Seed default OBEC integration settings (admin can override)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can view app_settings" ON public.app_settings;
CREATE POLICY "Authenticated can view app_settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage app_settings" ON public.app_settings;
CREATE POLICY "Admins manage app_settings" ON public.app_settings FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role='admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role='admin'));

INSERT INTO public.app_settings (key, value) VALUES
  ('obec_calendar_url', '"https://data.bopp-obec.info/api/calendar.ics"'::jsonb),
  ('obec_dmc_url', '"https://data.bopp-obec.info/api/dmc"'::jsonb),
  ('obec_school_code', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;
