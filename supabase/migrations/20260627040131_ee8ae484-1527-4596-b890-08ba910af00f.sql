
CREATE TABLE public.worksheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  grade_level text,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  cover_image text,
  share_code text UNIQUE NOT NULL DEFAULT lower(substring(gen_random_uuid()::text, 1, 8)),
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  school_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.worksheet_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id uuid NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
  student_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name text,
  classroom text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX worksheets_created_by_idx ON public.worksheets(created_by);
CREATE INDEX worksheets_share_code_idx ON public.worksheets(share_code);
CREATE INDEX worksheet_subs_worksheet_idx ON public.worksheet_submissions(worksheet_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worksheets TO authenticated;
GRANT SELECT ON public.worksheets TO anon;
GRANT ALL ON public.worksheets TO service_role;

GRANT SELECT, INSERT ON public.worksheet_submissions TO authenticated;
GRANT SELECT, INSERT ON public.worksheet_submissions TO anon;
GRANT ALL ON public.worksheet_submissions TO service_role;

ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worksheet_submissions ENABLE ROW LEVEL SECURITY;

-- Worksheets: published ones readable by anyone (incl. anon via share code); owners/admins manage
CREATE POLICY "ws_read_published" ON public.worksheets
  FOR SELECT USING (is_published = true OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ws_insert_own" ON public.worksheets
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "ws_update_own" ON public.worksheets
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ws_delete_own" ON public.worksheets
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Submissions: students/anon can insert; owners (teacher) and submitter can read
CREATE POLICY "wss_insert_any" ON public.worksheet_submissions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "wss_read_owner_or_self" ON public.worksheet_submissions
  FOR SELECT USING (
    student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.worksheets w
               WHERE w.id = worksheet_id
                 AND (w.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

CREATE TRIGGER trg_worksheets_updated
  BEFORE UPDATE ON public.worksheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
