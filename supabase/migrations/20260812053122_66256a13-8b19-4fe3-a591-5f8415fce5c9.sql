DROP POLICY IF EXISTS "leave-attachments read owner or admin" ON storage.objects;
CREATE POLICY "leave-attachments read owner or staff" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'leave-attachments'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR is_admin_or_director()
    OR has_role(auth.uid(),'teacher')
    OR has_dept_position(auth.uid(),'personnel','member')
    OR has_dept_position(auth.uid(),'student_affairs','member')
  )
);