ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_full_url text,
  ADD COLUMN IF NOT EXISTS cover_thumb_url text;