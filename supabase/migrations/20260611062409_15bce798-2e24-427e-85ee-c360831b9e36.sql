
ALTER TABLE public.task_assignments ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Storage policies on homework-files bucket
DROP POLICY IF EXISTS "Authenticated can read homework files" ON storage.objects;
CREATE POLICY "Authenticated can read homework files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'homework-files');

DROP POLICY IF EXISTS "Authenticated can upload homework files" ON storage.objects;
CREATE POLICY "Authenticated can upload homework files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'homework-files' AND owner = auth.uid());

DROP POLICY IF EXISTS "Owners can update their homework files" ON storage.objects;
CREATE POLICY "Owners can update their homework files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'homework-files' AND owner = auth.uid())
WITH CHECK (bucket_id = 'homework-files' AND owner = auth.uid());

DROP POLICY IF EXISTS "Owners and staff can delete homework files" ON storage.objects;
CREATE POLICY "Owners and staff can delete homework files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'homework-files'
  AND (owner = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role))
);
