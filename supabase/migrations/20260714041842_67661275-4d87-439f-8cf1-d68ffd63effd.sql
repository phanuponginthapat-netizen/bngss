CREATE TABLE IF NOT EXISTS public.line_richmenu_state (
  role TEXT PRIMARY KEY,
  richmenu_id TEXT,
  content_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto-svg',
  image_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT line_richmenu_state_role_check CHECK (role IN ('default','parent','teacher','director','admin')),
  CONSTRAINT line_richmenu_state_source_check CHECK (source IN ('auto-svg','upload'))
);

GRANT SELECT ON public.line_richmenu_state TO authenticated;
GRANT ALL ON public.line_richmenu_state TO service_role;

ALTER TABLE public.line_richmenu_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read richmenu state" ON public.line_richmenu_state;
CREATE POLICY "admin read richmenu state" ON public.line_richmenu_state
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- writes only via edge function (service_role) — no INSERT/UPDATE/DELETE policies for authenticated
