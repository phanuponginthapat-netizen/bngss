
-- Drop existing public SELECT policies for now-private buckets
DROP POLICY IF EXISTS "Public can view pp5 files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can view pp5 files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view ict loan photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view ict loan photos" ON storage.objects;

-- Authenticated SELECT for pp5-files
CREATE POLICY "Authenticated can view pp5 files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pp5-files');

-- Authenticated SELECT for ict-loan-photos
DROP POLICY IF EXISTS "Authenticated can view ict loan photos" ON storage.objects;
CREATE POLICY "Authenticated can view ict loan photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ict-loan-photos');

-- Remove ai_chat_logs from realtime publication (admin-only analytics, no realtime UI consumer)
ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_chat_logs;
