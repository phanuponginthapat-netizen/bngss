
ALTER TABLE public.homework_assignments
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS answer_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  school_id uuid,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  score numeric,
  feedback text,
  submitted_at timestamptz,
  graded_at timestamptz,
  graded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_submissions TO authenticated;
GRANT ALL ON public.homework_submissions TO service_role;

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

-- Student: own submissions
DROP POLICY IF EXISTS "students manage own submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "students manage own submissions" ON public.homework_submissions;
CREATE POLICY "students manage own submissions"
ON public.homework_submissions
FOR ALL
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

-- Teacher who created the assignment can view + grade
DROP POLICY IF EXISTS "assignment owner can view submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "assignment owner can view submissions" ON public.homework_submissions;
CREATE POLICY "assignment owner can view submissions"
ON public.homework_submissions
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.homework_assignments a
  WHERE a.id = assignment_id
    AND (a.created_by = auth.uid()
         OR a.school_id = public.get_user_school_id(auth.uid()))
));

DROP POLICY IF EXISTS "assignment owner can grade submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "assignment owner can grade submissions" ON public.homework_submissions;
CREATE POLICY "assignment owner can grade submissions"
ON public.homework_submissions
FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.homework_assignments a
  WHERE a.id = assignment_id
    AND (a.created_by = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::app_role)
         OR public.has_role(auth.uid(), 'director'::app_role))
));

DROP POLICY IF EXISTS "admins manage all submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "admins manage all submissions" ON public.homework_submissions;
CREATE POLICY "admins manage all submissions"
ON public.homework_submissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_homework_submissions_updated()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_homework_submissions_updated ON public.homework_submissions;
CREATE TRIGGER trg_homework_submissions_updated
BEFORE UPDATE ON public.homework_submissions
FOR EACH ROW EXECUTE FUNCTION public.tg_homework_submissions_updated();

-- Realtime
ALTER TABLE public.homework_submissions REPLICA IDENTITY FULL;
DO $$ BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'homework_submissions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.homework_submissions;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
