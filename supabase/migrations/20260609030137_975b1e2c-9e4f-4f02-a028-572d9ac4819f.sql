
ALTER TABLE public.student_leaves ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.staff_leaves ADD COLUMN IF NOT EXISTS attachment_url text;
