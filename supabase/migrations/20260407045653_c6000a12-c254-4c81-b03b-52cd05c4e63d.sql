
-- Add evidence_images column to pa_indicator_scores
ALTER TABLE public.pa_indicator_scores
ADD COLUMN evidence_images text[] DEFAULT '{}';

-- Add PDF file columns to pa_agreements
ALTER TABLE public.pa_agreements
ADD COLUMN pdf_file_url text,
ADD COLUMN pdf_file_name text;

-- Create storage bucket for PA files
INSERT INTO storage.buckets (id, name, public)
VALUES ('pa-files', 'pa-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload PA files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pa-files');

-- Allow public read
CREATE POLICY "PA files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'pa-files');

-- Allow authenticated users to update their files
CREATE POLICY "Authenticated users can update PA files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'pa-files');

-- Allow admins to delete
CREATE POLICY "Admins can delete PA files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pa-files');
