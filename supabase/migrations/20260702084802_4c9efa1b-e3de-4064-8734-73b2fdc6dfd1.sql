
-- Enums
DO $$ BEGIN
  CREATE TYPE public.reflection_status AS ENUM (
    'draft','submitted','head_signed','academic_signed','deputy_signed','director_signed','returned'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.reflection_signer_role AS ENUM (
    'teacher','head_subject','academic_head','deputy','director'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.teaching_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL,
  academic_period_id uuid REFERENCES public.academic_periods(id) ON DELETE SET NULL,
  subject_group text,
  lesson_topic text NOT NULL,
  lesson_date date NOT NULL DEFAULT CURRENT_DATE,
  period_no int,
  hours_taught numeric(4,2) DEFAULT 1,
  learning_outcomes text,
  students_total int DEFAULT 0,
  students_pass int DEFAULT 0,
  students_fail int DEFAULT 0,
  pass_percent numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN students_total > 0 THEN ROUND((students_pass::numeric / students_total::numeric) * 100, 2) ELSE 0 END
  ) STORED,
  score_knowledge int DEFAULT 0,
  score_process int DEFAULT 0,
  score_attitude int DEFAULT 0,
  assessment_data jsonb DEFAULT '{}'::jsonb,
  problems text,
  suggestions text,
  status public.reflection_status NOT NULL DEFAULT 'draft',
  current_step int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teaching_reflections TO authenticated;
GRANT ALL ON public.teaching_reflections TO service_role;
ALTER TABLE public.teaching_reflections ENABLE ROW LEVEL SECURITY;

-- Attachments
CREATE TABLE IF NOT EXISTS public.teaching_reflection_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reflection_id uuid NOT NULL REFERENCES public.teaching_reflections(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text,
  caption text,
  display_order int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teaching_reflection_attachments TO authenticated;
GRANT ALL ON public.teaching_reflection_attachments TO service_role;
ALTER TABLE public.teaching_reflection_attachments ENABLE ROW LEVEL SECURITY;

-- Signatures
CREATE TABLE IF NOT EXISTS public.teaching_reflection_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reflection_id uuid NOT NULL REFERENCES public.teaching_reflections(id) ON DELETE CASCADE,
  signer_role public.reflection_signer_role NOT NULL,
  signer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signer_name text,
  signature_url text,
  comment text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reflection_id, signer_role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teaching_reflection_signatures TO authenticated;
GRANT ALL ON public.teaching_reflection_signatures TO service_role;
ALTER TABLE public.teaching_reflection_signatures ENABLE ROW LEVEL SECURITY;

-- Helper: can user sign at a certain approval level?
CREATE OR REPLACE FUNCTION public.can_sign_reflection(_user_id uuid, _reflection_id uuid, _role public.reflection_signer_role)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.teaching_reflections%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.teaching_reflections WHERE id = _reflection_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF public.has_role(_user_id, 'admin') THEN RETURN true; END IF;

  IF _role = 'teacher' THEN
    RETURN r.teacher_id = _user_id;
  ELSIF _role = 'head_subject' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.subject_group_heads sgh
      WHERE sgh.user_id = _user_id
        AND sgh.subject_group::text = r.subject_group
    );
  ELSIF _role = 'academic_head' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_departments ud
      WHERE ud.user_id = _user_id
        AND ud.department = 'academic'
        AND ud.position IN ('head','deputy')
    );
  ELSIF _role = 'deputy' THEN
    RETURN public.has_role(_user_id, 'director') OR EXISTS (
      SELECT 1 FROM public.user_departments ud
      WHERE ud.user_id = _user_id
        AND ud.department = 'director_office'
        AND ud.position IN ('deputy','head')
    );
  ELSIF _role = 'director' THEN
    RETURN public.has_role(_user_id, 'director');
  END IF;
  RETURN false;
END; $$;

-- RLS: teaching_reflections
CREATE POLICY "reflections_select" ON public.teaching_reflections FOR SELECT TO authenticated
USING (
  teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'director')
  OR EXISTS (
    SELECT 1 FROM public.user_departments ud
    WHERE ud.user_id = auth.uid() AND ud.department = 'academic'
  )
  OR EXISTS (
    SELECT 1 FROM public.subject_group_heads sgh
    WHERE sgh.user_id = auth.uid() AND sgh.subject_group::text = teaching_reflections.subject_group
  )
);

CREATE POLICY "reflections_insert" ON public.teaching_reflections FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "reflections_update" ON public.teaching_reflections FOR UPDATE TO authenticated
USING (
  (teacher_id = auth.uid() AND status IN ('draft','returned'))
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'director')
  OR EXISTS (
    SELECT 1 FROM public.user_departments ud
    WHERE ud.user_id = auth.uid() AND ud.department = 'academic' AND ud.position IN ('head','deputy')
  )
);

CREATE POLICY "reflections_delete" ON public.teaching_reflections FOR DELETE TO authenticated
USING (
  (teacher_id = auth.uid() AND status = 'draft')
  OR public.has_role(auth.uid(), 'admin')
);

-- RLS: attachments
CREATE POLICY "refl_attach_select" ON public.teaching_reflection_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.teaching_reflections r WHERE r.id = reflection_id));

CREATE POLICY "refl_attach_write" ON public.teaching_reflection_attachments FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.teaching_reflections r WHERE r.id = reflection_id
    AND (r.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.teaching_reflections r WHERE r.id = reflection_id
    AND (r.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
));

-- RLS: signatures
CREATE POLICY "refl_sig_select" ON public.teaching_reflection_signatures FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.teaching_reflections r WHERE r.id = reflection_id));

CREATE POLICY "refl_sig_insert" ON public.teaching_reflection_signatures FOR INSERT TO authenticated
WITH CHECK (
  signer_id = auth.uid()
  AND public.can_sign_reflection(auth.uid(), reflection_id, signer_role)
);

CREATE POLICY "refl_sig_delete" ON public.teaching_reflection_signatures FOR DELETE TO authenticated
USING (signer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tr_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_teaching_reflections_updated ON public.teaching_reflections;
CREATE TRIGGER trg_teaching_reflections_updated
BEFORE UPDATE ON public.teaching_reflections
FOR EACH ROW EXECUTE FUNCTION public.tr_touch_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_refl_teacher ON public.teaching_reflections(teacher_id);
CREATE INDEX IF NOT EXISTS idx_refl_period ON public.teaching_reflections(academic_period_id);
CREATE INDEX IF NOT EXISTS idx_refl_subject ON public.teaching_reflections(subject_id);
CREATE INDEX IF NOT EXISTS idx_refl_class ON public.teaching_reflections(classroom_id);
CREATE INDEX IF NOT EXISTS idx_refl_status ON public.teaching_reflections(status);
CREATE INDEX IF NOT EXISTS idx_refl_attach ON public.teaching_reflection_attachments(reflection_id);
CREATE INDEX IF NOT EXISTS idx_refl_sig ON public.teaching_reflection_signatures(reflection_id);

-- Realtime
ALTER TABLE public.teaching_reflections REPLICA IDENTITY FULL;
ALTER TABLE public.teaching_reflection_attachments REPLICA IDENTITY FULL;
ALTER TABLE public.teaching_reflection_signatures REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.teaching_reflections;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.teaching_reflection_attachments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.teaching_reflection_signatures;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
