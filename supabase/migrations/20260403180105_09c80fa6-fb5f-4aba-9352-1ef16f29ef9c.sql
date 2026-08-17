
-- Table to track uploaded PP5 files
CREATE TABLE IF NOT EXISTS public.pp5_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  subject_name TEXT,
  subject_code TEXT,
  grade_level TEXT NOT NULL,
  semester INTEGER DEFAULT 1,
  academic_year INTEGER NOT NULL DEFAULT EXTRACT(year FROM now()),
  teacher_name TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pp5_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users can view pp5_files" ON public.pp5_files;
CREATE POLICY "Auth users can view pp5_files"
ON public.pp5_files FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Auth users can upload pp5_files" ON public.pp5_files;
CREATE POLICY "Auth users can upload pp5_files"
ON public.pp5_files FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Admin/Director can delete pp5_files" ON public.pp5_files;
CREATE POLICY "Admin/Director can delete pp5_files"
ON public.pp5_files FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Storage bucket for PP5 files
INSERT INTO storage.buckets (id, name, public) VALUES ('pp5-files', 'pp5-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Auth users can view pp5 files" ON storage.objects;
CREATE POLICY "Auth users can view pp5 files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pp5-files');

DROP POLICY IF EXISTS "Auth users can upload pp5 files" ON storage.objects;
CREATE POLICY "Auth users can upload pp5 files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pp5-files');

DROP POLICY IF EXISTS "Admin can delete pp5 files" ON storage.objects;
CREATE POLICY "Admin can delete pp5 files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pp5-files' AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role)));
