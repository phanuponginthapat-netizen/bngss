
-- PA Agreements main table
CREATE TABLE IF NOT EXISTS public.pa_agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE,
  academic_year INTEGER DEFAULT EXTRACT(year FROM now()),
  position_type TEXT NOT NULL DEFAULT 'teacher', -- teacher, director, vice_director
  status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, evaluated, approved
  total_score NUMERIC DEFAULT 0,
  result_level TEXT, -- ดีเด่น, ดีมาก, ดี, พอใช้, ปรับปรุง
  evaluator_name TEXT,
  evaluator_position TEXT,
  evaluator_comments TEXT,
  submitted_at TIMESTAMPTZ,
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- PA Indicator Scores
CREATE TABLE IF NOT EXISTS public.pa_indicator_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pa_agreement_id UUID NOT NULL REFERENCES public.pa_agreements(id) ON DELETE CASCADE,
  domain INTEGER NOT NULL DEFAULT 1, -- ด้านที่ 1 หรือ 2
  indicator_number INTEGER NOT NULL,
  indicator_title TEXT NOT NULL,
  score NUMERIC DEFAULT 0, -- 0-4 for each indicator
  max_score NUMERIC DEFAULT 4,
  evidence TEXT, -- หลักฐาน/ผลงาน
  evaluator_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pa_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pa_indicator_scores ENABLE ROW LEVEL SECURITY;

-- RLS for pa_agreements
DROP POLICY IF EXISTS "Auth users can view pa_agreements" ON public.pa_agreements;
DROP POLICY IF EXISTS "Auth users can view pa_agreements" ON public.pa_agreements;
CREATE POLICY "Auth users can view pa_agreements"
  ON public.pa_agreements FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin/Director can manage pa_agreements" ON public.pa_agreements;
DROP POLICY IF EXISTS "Admin/Director can manage pa_agreements" ON public.pa_agreements;
CREATE POLICY "Admin/Director can manage pa_agreements"
  ON public.pa_agreements FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Users can manage own pa_agreements" ON public.pa_agreements;
DROP POLICY IF EXISTS "Users can manage own pa_agreements" ON public.pa_agreements;
CREATE POLICY "Users can manage own pa_agreements"
  ON public.pa_agreements FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- RLS for pa_indicator_scores
DROP POLICY IF EXISTS "Auth users can view pa_indicator_scores" ON public.pa_indicator_scores;
DROP POLICY IF EXISTS "Auth users can view pa_indicator_scores" ON public.pa_indicator_scores;
CREATE POLICY "Auth users can view pa_indicator_scores"
  ON public.pa_indicator_scores FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin/Director can manage pa_indicator_scores" ON public.pa_indicator_scores;
DROP POLICY IF EXISTS "Admin/Director can manage pa_indicator_scores" ON public.pa_indicator_scores;
CREATE POLICY "Admin/Director can manage pa_indicator_scores"
  ON public.pa_indicator_scores FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Users can manage own pa_indicator_scores" ON public.pa_indicator_scores;
DROP POLICY IF EXISTS "Users can manage own pa_indicator_scores" ON public.pa_indicator_scores;
CREATE POLICY "Users can manage own pa_indicator_scores"
  ON public.pa_indicator_scores FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pa_agreements pa 
      WHERE pa.id = pa_agreement_id AND pa.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pa_agreements pa 
      WHERE pa.id = pa_agreement_id AND pa.created_by = auth.uid()
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pa_agreements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pa_indicator_scores;

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_pa_agreements_updated_at ON public.pa_agreements;
CREATE TRIGGER update_pa_agreements_updated_at
  BEFORE UPDATE ON public.pa_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
