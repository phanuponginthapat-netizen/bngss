
-- 1. Extend pdf_templates
ALTER TABLE public.pdf_templates
  ADD COLUMN IF NOT EXISTS public_slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_student_code boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sync_targets jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Allow anon to read only PUBLIC templates (for the public form renderer)
DROP POLICY IF EXISTS "Anyone can view public templates" ON public.pdf_templates;
CREATE POLICY "Anyone can view public templates"
  ON public.pdf_templates FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

GRANT SELECT ON public.pdf_templates TO anon;

-- 2. form_submissions
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.pdf_templates(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  submitted_by uuid,
  submitter_name text,
  submitter_contact text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'submitted',
  synced_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_submissions TO authenticated;
GRANT INSERT ON public.form_submissions TO anon;
GRANT ALL ON public.form_submissions TO service_role;

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Helper: only allow insert if the referenced template is public
CREATE OR REPLACE FUNCTION public.is_template_public(_tid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_public FROM public.pdf_templates WHERE id = _tid), false)
$$;

-- anon/authenticated INSERT — only when template.is_public
CREATE POLICY "Public submit to public templates"
  ON public.form_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.is_template_public(template_id));

-- admin/teacher: see all submissions for their school
CREATE POLICY "Staff read submissions"
  ON public.form_submissions FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );

CREATE POLICY "Staff manage submissions"
  ON public.form_submissions FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  );

CREATE POLICY "Staff delete submissions"
  ON public.form_submissions FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  );

-- updated_at trigger
CREATE TRIGGER trg_form_submissions_updated
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_form_submissions_template ON public.form_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_student ON public.form_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_created ON public.form_submissions(created_at DESC);

-- 3. Public RPC to look up a student by student_code (used for prefill on public form)
CREATE OR REPLACE FUNCTION public.lookup_student_for_public_form(_code text)
RETURNS TABLE (
  id uuid, student_code text, prefix text, first_name text, last_name text,
  national_id text, date_of_birth date, gender text, address text,
  classroom_id uuid, school_id uuid,
  guardian_name text, guardian_phone text, guardian_relation text,
  father_name text, mother_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.student_code, s.prefix, s.first_name, s.last_name,
         s.national_id, s.date_of_birth, s.gender, s.address,
         s.classroom_id, s.school_id,
         s.guardian_name, s.guardian_phone, s.guardian_relation,
         s.father_name, s.mother_name
  FROM public.students s
  WHERE s.student_code = _code AND s.status = 'active'
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.lookup_student_for_public_form(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_template_public(uuid) TO anon, authenticated;
