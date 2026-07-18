-- 1) Fix students visibility — require parent_user_id match for parent role
DROP POLICY IF EXISTS "Student visibility scoped" ON public.students;
CREATE POLICY "Student visibility scoped" ON public.students
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR (auth_user_id = auth.uid())
  OR is_homeroom_of_classroom(auth.uid(), classroom_id)
  OR is_teacher_assigned_to_classroom(auth.uid(), classroom_id)
  OR (
    has_role(auth.uid(), 'parent'::app_role)
    AND (
      parent_user_id = auth.uid()
      OR parent_user_id_2 = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.line_user_id IS NOT NULL
          AND (
            p.line_user_id = students.line_user_id
            OR p.line_user_id = students.line_user_id_2
            OR p.line_user_id = students.line_user_id_3
          )
      )
    )
  )
);

-- 2) Remove sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.mfa_settings;
ALTER PUBLICATION supabase_realtime DROP TABLE public.guidance_records;
ALTER PUBLICATION supabase_realtime DROP TABLE public.procurement_advances;