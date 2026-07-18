
ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS indicator_code TEXT,
  ADD COLUMN IF NOT EXISTS indicator_description TEXT;
