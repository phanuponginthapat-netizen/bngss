DROP POLICY IF EXISTS "Teachers can view all students in same school" ON public.students;
DROP POLICY IF EXISTS "Teachers can view all students in same school" ON public.students;
CREATE POLICY "Teachers can view all students in same school" ON public.students
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND (
    school_id IS NULL
    OR school_id = get_user_school_id(auth.uid())
  )
);