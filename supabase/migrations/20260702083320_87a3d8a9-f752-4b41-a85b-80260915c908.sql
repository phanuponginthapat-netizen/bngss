
CREATE TABLE IF NOT EXISTS public.browser_shortcuts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_th TEXT NOT NULL,
  label_en TEXT NOT NULL,
  icon TEXT,
  logo_url TEXT,
  bg_class TEXT NOT NULL DEFAULT 'bg-gradient-to-br from-sky-400 to-blue-600',
  target_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  visible_roles TEXT[] NOT NULL DEFAULT ARRAY['admin','director','teacher','student','alumni','parent'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.browser_shortcuts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.browser_shortcuts TO authenticated;
GRANT ALL ON public.browser_shortcuts TO service_role;

ALTER TABLE public.browser_shortcuts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read shortcuts" ON public.browser_shortcuts;
DROP POLICY IF EXISTS "authenticated can read shortcuts" ON public.browser_shortcuts;
CREATE POLICY "authenticated can read shortcuts"
  ON public.browser_shortcuts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admins manage shortcuts" ON public.browser_shortcuts;
DROP POLICY IF EXISTS "admins manage shortcuts" ON public.browser_shortcuts;
CREATE POLICY "admins manage shortcuts"
  ON public.browser_shortcuts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP TRIGGER IF EXISTS trg_browser_shortcuts_updated ON public.browser_shortcuts;
CREATE TRIGGER trg_browser_shortcuts_updated
  BEFORE UPDATE ON public.browser_shortcuts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.browser_shortcuts;

INSERT INTO public.browser_shortcuts (label_th, label_en, icon, target_url, bg_class, sort_order)
SELECT * FROM (VALUES
  ('Docs','Docs','FileText','https://docs.google.com','bg-gradient-to-br from-sky-400 to-blue-600',10),
  ('Sheets','Sheets','Sheet','https://sheets.google.com','bg-gradient-to-br from-green-400 to-emerald-600',20),
  ('Slides','Slides','Presentation','https://slides.google.com','bg-gradient-to-br from-yellow-400 to-amber-500',30),
  ('Drive','Drive','HardDrive','https://drive.google.com','bg-gradient-to-br from-lime-400 to-emerald-600',40),
  ('Gmail','Gmail','Mail','https://mail.google.com','bg-gradient-to-br from-red-400 to-rose-600',50),
  ('Classroom','Classroom','GraduationCap','https://classroom.google.com','bg-gradient-to-br from-green-400 to-emerald-600',60),
  ('YouTube','YouTube','Youtube','https://www.youtube.com','bg-gradient-to-br from-red-400 to-rose-600',70),
  ('Translate','Translate','Languages','https://translate.google.com','bg-gradient-to-br from-cyan-400 to-blue-600',80),
  ('Maps','Maps','Map','https://www.google.com/maps','bg-gradient-to-br from-orange-400 to-red-500',90),
  ('Wikipedia','Wikipedia','BookOpen','https://th.wikipedia.org','bg-gradient-to-br from-slate-400 to-slate-600',100)
) AS v(label_th, label_en, icon, target_url, bg_class, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.browser_shortcuts t WHERE t.target_url = v.target_url);
