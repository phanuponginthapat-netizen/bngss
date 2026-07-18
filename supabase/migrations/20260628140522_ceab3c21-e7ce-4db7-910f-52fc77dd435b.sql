-- 1) Enrollment history snapshot
CREATE TABLE IF NOT EXISTS public.student_enrollment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  academic_year INTEGER NOT NULL,
  classroom_id UUID,
  classroom_name TEXT,
  grade_level TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, academic_year)
);

GRANT SELECT ON public.student_enrollment_history TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.student_enrollment_history TO authenticated;
GRANT ALL ON public.student_enrollment_history TO service_role;

ALTER TABLE public.student_enrollment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrollment_history_read_authenticated"
  ON public.student_enrollment_history FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "enrollment_history_write_admin"
  ON public.student_enrollment_history FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE INDEX IF NOT EXISTS idx_enroll_hist_student ON public.student_enrollment_history(student_id);
CREATE INDEX IF NOT EXISTS idx_enroll_hist_year ON public.student_enrollment_history(academic_year);

-- 2) Promotion runs log (for rollback)
CREATE TABLE IF NOT EXISTS public.promotion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  run_by UUID,
  academic_year INTEGER NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.promotion_runs TO authenticated;
GRANT ALL ON public.promotion_runs TO service_role;

ALTER TABLE public.promotion_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotion_runs_admin_only"
  ON public.promotion_runs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE INDEX IF NOT EXISTS idx_promotion_runs_year ON public.promotion_runs(academic_year);