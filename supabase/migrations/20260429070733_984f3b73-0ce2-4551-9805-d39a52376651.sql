ALTER TABLE public.personnel DROP COLUMN IF EXISTS face_photo_url;
ALTER TABLE public.personnel DROP COLUMN IF EXISTS face_photos;
ALTER TABLE public.students DROP COLUMN IF EXISTS face_photo_url;
ALTER TABLE public.students DROP COLUMN IF EXISTS face_photos;
ALTER TABLE public.time_clock DROP COLUMN IF EXISTS face_photo_url;
ALTER TABLE public.time_clock DROP COLUMN IF EXISTS face_verified;

DELETE FROM public.school_settings WHERE setting_key = 'face_verify_enabled';