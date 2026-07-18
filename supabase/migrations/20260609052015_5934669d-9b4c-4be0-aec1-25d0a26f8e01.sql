
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS is_special_needs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS special_needs_type text;

CREATE INDEX IF NOT EXISTS students_is_special_needs_idx
  ON public.students (is_special_needs) WHERE is_special_needs = true;
