
-- Add education/work history columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS education_history jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS work_history jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS hire_date date,
ADD COLUMN IF NOT EXISTS leave_date date;

-- Create personnel_assessments table for personality/aptitude self-assessment
CREATE TABLE public.personnel_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  assessment_type text NOT NULL DEFAULT 'personality',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores jsonb DEFAULT '{}'::jsonb,
  total_score numeric DEFAULT 0,
  result_summary text,
  academic_year integer DEFAULT EXTRACT(year FROM now()),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personnel_assessments ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own assessments
CREATE POLICY "Users can manage own assessments"
ON public.personnel_assessments
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin/Director can view all assessments
CREATE POLICY "Admin/Director can view all assessments"
ON public.personnel_assessments
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);
