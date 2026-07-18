DROP POLICY IF EXISTS "Staff can view students in their school" ON public.students;

CREATE POLICY "Staff can view students in their school"
ON public.students FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR (
    has_role(auth.uid(), 'teacher'::app_role)
    AND (
      school_id IS NULL
      OR get_user_school_id(auth.uid()) IS NULL
      OR school_id = get_user_school_id(auth.uid())
    )
  )
);