-- Add face photo to personnel
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS face_photo_url text;

-- Add GPS and face verification columns to time_clock
ALTER TABLE public.time_clock ADD COLUMN IF NOT EXISTS clock_lat double precision;
ALTER TABLE public.time_clock ADD COLUMN IF NOT EXISTS clock_lng double precision;
ALTER TABLE public.time_clock ADD COLUMN IF NOT EXISTS face_photo_url text;
ALTER TABLE public.time_clock ADD COLUMN IF NOT EXISTS face_verified boolean DEFAULT false;
ALTER TABLE public.time_clock ADD COLUMN IF NOT EXISTS gps_verified boolean DEFAULT false;

-- Create face-photos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('face-photos', 'face-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for face-photos
DROP POLICY IF EXISTS "Auth users can upload face photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload face photos" ON storage.objects;
CREATE POLICY "Auth users can upload face photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'face-photos');

DROP POLICY IF EXISTS "Anyone can view face photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view face photos" ON storage.objects;
CREATE POLICY "Anyone can view face photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'face-photos');

DROP POLICY IF EXISTS "Auth users can update face photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update face photos" ON storage.objects;
CREATE POLICY "Auth users can update face photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'face-photos');

DROP POLICY IF EXISTS "Auth users can delete face photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete face photos" ON storage.objects;
CREATE POLICY "Auth users can delete face photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'face-photos');