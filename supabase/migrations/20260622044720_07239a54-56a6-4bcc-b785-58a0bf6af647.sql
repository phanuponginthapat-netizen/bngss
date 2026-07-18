
-- 1) Per-column enable flag (ติ๊กเปิดช่องคะแนน)
ALTER TABLE public.subject_score_columns
  ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;

-- 2) Grading config per subject (สัดส่วน 100%)
CREATE TABLE IF NOT EXISTS public.subject_grading_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL UNIQUE REFERENCES public.subjects(id) ON DELETE CASCADE,
  weight_during numeric NOT NULL DEFAULT 70,
  weight_final numeric NOT NULL DEFAULT 30,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weights_sum_100 CHECK (weight_during + weight_final = 100),
  CONSTRAINT weights_nonneg CHECK (weight_during >= 0 AND weight_final >= 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_grading_config TO authenticated;
GRANT ALL ON public.subject_grading_config TO service_role;

ALTER TABLE public.subject_grading_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read grading config"
  ON public.subject_grading_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Teachers/Admin manage grading config"
  ON public.subject_grading_config FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')
    OR EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      JOIN public.personnel p ON p.id = ta.personnel_id
      WHERE ta.subject_id = subject_grading_config.subject_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')
    OR EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      JOIN public.personnel p ON p.id = ta.personnel_id
      WHERE ta.subject_id = subject_grading_config.subject_id
        AND p.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_subject_grading_config_updated_at
  BEFORE UPDATE ON public.subject_grading_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
