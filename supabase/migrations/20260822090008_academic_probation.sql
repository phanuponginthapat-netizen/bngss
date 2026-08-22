CREATE TABLE IF NOT EXISTS public.academic_probation (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id),
  academic_year integer NOT NULL,
  semester integer NOT NULL,
  gpax numeric,
  status text DEFAULT 'at_risk' CHECK (status IN ('at_risk', 'warning', 'cleared', 'probation')),
  notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.academic_probation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view probation" ON public.academic_probation FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins manage probation" ON public.academic_probation FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'director'))
);
