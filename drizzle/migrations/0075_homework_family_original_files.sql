CREATE POLICY "homework family read assigned task originals"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'homework-files'
  AND EXISTS (
    SELECT 1 FROM public.task_assignments t
    JOIN public.students s ON (
      s.auth_user_id = auth.uid()
      OR s.parent_user_id = auth.uid()
      OR s.parent_user_id_2 = auth.uid()
    )
    WHERE t.task_type = 'homework'
      AND (
        t.assigned_to_student_id = s.id
        OR (t.assigned_to_student_id IS NULL AND t.classroom_id = s.classroom_id)
      )
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(t.attachments) = 'array' THEN t.attachments ELSE '[]'::jsonb END
        ) a WHERE a->>'path' = storage.objects.name
      )
  )
);