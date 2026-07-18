ALTER TABLE public.student_face_descriptors
  ADD COLUMN IF NOT EXISTS face_image text,
  ADD COLUMN IF NOT EXISTS metrics jsonb;