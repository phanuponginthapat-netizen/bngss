CREATE POLICY "homework assigned students read worksheet pdf"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'homework-files'
  AND EXISTS (
    SELECT 1
    FROM public.homework_assignments a
    JOIN public.students s ON s.auth_user_id = auth.uid()
    WHERE a.pdf_path = storage.objects.name
      AND (a.school_id IS NULL OR a.school_id = s.school_id)
      AND (a.classroom_id IS NULL OR a.classroom_id = s.classroom_id)
  )
);