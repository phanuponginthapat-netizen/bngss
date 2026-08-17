
CREATE TABLE IF NOT EXISTS public.home_visit_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid,
  academic_year integer NOT NULL,
  semester integer NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  reporter_name text,
  reporter_position text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year, semester)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.home_visit_summaries TO authenticated;
GRANT ALL ON public.home_visit_summaries TO service_role;

ALTER TABLE public.home_visit_summaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view home visit summaries" ON public.home_visit_summaries;
DROP POLICY IF EXISTS "Staff can view home visit summaries" ON public.home_visit_summaries;
CREATE POLICY "Staff can view home visit summaries"
  ON public.home_visit_summaries FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );

DROP POLICY IF EXISTS "Staff can insert home visit summaries" ON public.home_visit_summaries;
DROP POLICY IF EXISTS "Staff can insert home visit summaries" ON public.home_visit_summaries;
CREATE POLICY "Staff can insert home visit summaries"
  ON public.home_visit_summaries FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );

DROP POLICY IF EXISTS "Staff can update home visit summaries" ON public.home_visit_summaries;
DROP POLICY IF EXISTS "Staff can update home visit summaries" ON public.home_visit_summaries;
CREATE POLICY "Staff can update home visit summaries"
  ON public.home_visit_summaries FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );

DROP POLICY IF EXISTS "Admin/director can delete home visit summaries" ON public.home_visit_summaries;
DROP POLICY IF EXISTS "Admin/director can delete home visit summaries" ON public.home_visit_summaries;
CREATE POLICY "Admin/director can delete home visit summaries"
  ON public.home_visit_summaries FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  );

DROP TRIGGER IF EXISTS trg_home_visit_summaries_updated ON public.home_visit_summaries;
CREATE TRIGGER trg_home_visit_summaries_updated
  BEFORE UPDATE ON public.home_visit_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
