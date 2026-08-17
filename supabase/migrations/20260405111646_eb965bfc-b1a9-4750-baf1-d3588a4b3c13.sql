
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_code_key;
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_code_semester_key;
ALTER TABLE public.subjects ADD CONSTRAINT subjects_code_semester_key UNIQUE (code, semester);
