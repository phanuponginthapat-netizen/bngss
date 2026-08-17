
-- Create pp6_files table (similar to pp5_files)
CREATE TABLE IF NOT EXISTS public.pp6_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID,
  teacher_name TEXT,
  academic_year INTEGER NOT NULL DEFAULT EXTRACT(year FROM now()),
  semester INTEGER DEFAULT 1,
  grade_level TEXT NOT NULL,
  classroom_name TEXT,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL
);

ALTER TABLE public.pp6_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users can view pp6_files" ON public.pp6_files;
DROP POLICY IF EXISTS "Auth users can view pp6_files" ON public.pp6_files;
CREATE POLICY "Auth users can view pp6_files" ON public.pp6_files FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth users can upload pp6_files" ON public.pp6_files;
DROP POLICY IF EXISTS "Auth users can upload pp6_files" ON public.pp6_files;
CREATE POLICY "Auth users can upload pp6_files" ON public.pp6_files FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admin/Director can delete pp6_files" ON public.pp6_files;
DROP POLICY IF EXISTS "Admin/Director can delete pp6_files" ON public.pp6_files;
CREATE POLICY "Admin/Director can delete pp6_files" ON public.pp6_files FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Create storage bucket for pp6 files
INSERT INTO storage.buckets (id, name, public) VALUES ('pp6-files', 'pp6-files', true) ON CONFLICT DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "Anyone can view pp6 files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view pp6 files" ON storage.objects;
CREATE POLICY "Anyone can view pp6 files" ON storage.objects FOR SELECT USING (bucket_id = 'pp6-files');
DROP POLICY IF EXISTS "Auth users can upload pp6 files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload pp6 files" ON storage.objects;
CREATE POLICY "Auth users can upload pp6 files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pp6-files');
DROP POLICY IF EXISTS "Admin can delete pp6 files" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete pp6 files" ON storage.objects;
CREATE POLICY "Admin can delete pp6 files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'pp6-files');
