CREATE POLICY "task attachments assigned recipient read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.task_assignments t
    WHERE t.task_type = 'assignment'
      AND t.assigned_to_user_id = auth.uid()
      AND t.assigned_by::text = split_part(objects.name, '/', 1)
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(t.attachments) = 'array' THEN t.attachments ELSE '[]'::jsonb END
        ) a
        WHERE (CASE WHEN jsonb_typeof(a) = 'string' THEN a #>> '{}' ELSE a ->> 'path' END) = objects.name
      )
  )
);