-- Add face_photos array column to personnel (keep face_photo_url for backward compat)
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS face_photos text[] DEFAULT ARRAY[]::text[];