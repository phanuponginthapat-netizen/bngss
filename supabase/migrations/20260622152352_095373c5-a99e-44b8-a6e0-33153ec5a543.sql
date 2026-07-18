
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS weight_assignment numeric NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS weight_midterm    numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS weight_final      numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS weight_attendance numeric NOT NULL DEFAULT 0;
