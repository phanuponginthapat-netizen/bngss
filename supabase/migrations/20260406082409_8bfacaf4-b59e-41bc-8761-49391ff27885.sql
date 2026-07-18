-- Add face columns to students
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS face_photo_url text,
ADD COLUMN IF NOT EXISTS face_photos text[] DEFAULT ARRAY[]::text[];

-- Add student_id to time_clock for student attendance
ALTER TABLE public.time_clock
ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE;

-- Make personnel_id nullable (since students won't have one)
ALTER TABLE public.time_clock
ALTER COLUMN personnel_id DROP NOT NULL;