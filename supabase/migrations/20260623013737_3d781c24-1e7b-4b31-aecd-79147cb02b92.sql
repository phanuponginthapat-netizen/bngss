ALTER TABLE public.incomplete_grade_reports
  ALTER COLUMN subject_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS subject_name_text text,
  ADD COLUMN IF NOT EXISTS teacher_name_text text,
  ADD COLUMN IF NOT EXISTS grade_level_text text,
  ADD COLUMN IF NOT EXISTS classroom_room integer,
  ADD COLUMN IF NOT EXISTS student_no integer,
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.incomplete_grade_reports
  DROP CONSTRAINT IF EXISTS incomplete_grade_reports_subject_or_text_chk;
ALTER TABLE public.incomplete_grade_reports
  ADD CONSTRAINT incomplete_grade_reports_subject_or_text_chk
  CHECK (subject_id IS NOT NULL OR subject_name_text IS NOT NULL);