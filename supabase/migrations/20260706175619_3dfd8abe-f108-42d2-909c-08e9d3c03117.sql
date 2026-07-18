DROP POLICY IF EXISTS "Homework files: owner or same-school members" ON storage.objects;

CREATE POLICY "Homework files: owner or same-school members"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'homework-files'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'director'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.task_assignments t
      LEFT JOIN public.classrooms c ON c.id = t.classroom_id
      WHERE (
        t.assigned_by = auth.uid()
        OR t.assigned_to_user_id = auth.uid()
        OR (c.school_id IS NOT NULL AND c.school_id = public.get_user_school_id(auth.uid()))
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.homework_assignments h
      LEFT JOIN public.classrooms c ON c.id = h.classroom_id
      LEFT JOIN public.students s ON s.classroom_id = h.classroom_id AND s.auth_user_id = auth.uid()
      WHERE (
        h.created_by = auth.uid()
        OR s.id IS NOT NULL
        OR (c.school_id IS NOT NULL AND c.school_id = public.get_user_school_id(auth.uid()))
      )
    )
  )
);