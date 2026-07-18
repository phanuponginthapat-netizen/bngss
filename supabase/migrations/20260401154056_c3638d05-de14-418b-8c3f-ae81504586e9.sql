
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS auth_email text,
ADD COLUMN IF NOT EXISTS auth_user_id uuid;
