
-- Add photo columns to time_clock
ALTER TABLE public.time_clock 
  ADD COLUMN IF NOT EXISTS clock_in_photo_url text,
  ADD COLUMN IF NOT EXISTS clock_out_photo_url text;

-- Create storage bucket for attendance photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('attendance-photos', 'attendance-photos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage
DROP POLICY IF EXISTS "Attendance photos public read" ON storage.objects;
DROP POLICY IF EXISTS "Attendance photos public read" ON storage.objects;
CREATE POLICY "Attendance photos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'attendance-photos');

DROP POLICY IF EXISTS "Auth users can upload attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload attendance photos" ON storage.objects;
CREATE POLICY "Auth users can upload attendance photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attendance-photos');

DROP POLICY IF EXISTS "Admin can manage attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Admin can manage attendance photos" ON storage.objects;
CREATE POLICY "Admin can manage attendance photos" ON storage.objects
  FOR ALL TO authenticated USING (
    bucket_id = 'attendance-photos' AND (
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role)
    )
  );
