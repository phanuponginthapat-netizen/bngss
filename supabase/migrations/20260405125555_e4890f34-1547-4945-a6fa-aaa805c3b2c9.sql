ALTER TABLE public.subjects DROP CONSTRAINT subjects_semester_check;
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_semester_check;
ALTER TABLE public.subjects ADD CONSTRAINT subjects_semester_check CHECK (semester = ANY (ARRAY[0, 1, 2]));