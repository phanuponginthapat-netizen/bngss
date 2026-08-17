DROP POLICY IF EXISTS "Admin/Director can manage students" ON public.students;
DROP POLICY IF EXISTS "Admin/Director can manage students" ON public.students;
CREATE POLICY "Admin/Director can manage students"
  ON public.students FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

DROP POLICY IF EXISTS "Homeroom teachers can update their students" ON public.students;
DROP POLICY IF EXISTS "Homeroom teachers can update their students" ON public.students;
CREATE POLICY "Homeroom teachers can update their students"
  ON public.students FOR UPDATE TO authenticated
  USING (is_homeroom_of_classroom(auth.uid(), classroom_id))
  WITH CHECK (is_homeroom_of_classroom(auth.uid(), classroom_id));

DROP POLICY IF EXISTS "Staff can view students in their school" ON public.students;
DROP POLICY IF EXISTS "Staff can view students in their school" ON public.students;
CREATE POLICY "Staff can view students in their school"
  ON public.students FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR (
      has_role(auth.uid(), 'teacher'::app_role)
      AND (school_id IS NULL OR get_user_school_id(auth.uid()) IS NULL OR school_id = get_user_school_id(auth.uid()))
    )
  );

GRANT EXECUTE ON FUNCTION public.get_user_school_id(uuid) TO anon;