
-- Add new columns to home_visits for OBEC requirements
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS latitude double precision DEFAULT NULL;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS longitude double precision DEFAULT NULL;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS poverty_status text DEFAULT 'ไม่ยากจน';
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS income_per_month numeric DEFAULT NULL;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS house_ownership text DEFAULT NULL;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS living_with text DEFAULT NULL;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS num_family_members integer DEFAULT NULL;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS has_internet boolean DEFAULT false;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS has_computer boolean DEFAULT false;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS travel_method text DEFAULT NULL;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS distance_to_school numeric DEFAULT NULL;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT ARRAY[]::text[];
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES public.classrooms(id) DEFAULT NULL;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS student_condition text DEFAULT NULL;
ALTER TABLE public.home_visits ADD COLUMN IF NOT EXISTS family_status text DEFAULT NULL;

-- Create storage bucket for home visit photos
INSERT INTO storage.buckets (id, name, public) VALUES ('home-visit-photos', 'home-visit-photos', true) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload home visit photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'home-visit-photos');

CREATE POLICY "Anyone can view home visit photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'home-visit-photos');

CREATE POLICY "Authenticated users can delete home visit photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'home-visit-photos');
