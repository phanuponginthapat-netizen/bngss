
-- Add line_user_id to profiles for teachers/staff
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS line_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_line_user_id ON public.profiles (line_user_id) WHERE line_user_id IS NOT NULL;

-- Add line_user_id to students for students/parents
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS line_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_students_line_user_id ON public.students (line_user_id) WHERE line_user_id IS NOT NULL;
