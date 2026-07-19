
ALTER TABLE public.guidance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_scope_restrictive ON public.guidance_records;
CREATE POLICY school_scope_restrictive ON public.guidance_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
  WITH CHECK (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS school_scope_teacher ON public.guidance_records;
CREATE POLICY school_scope_teacher ON public.guidance_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR NOT has_role(auth.uid(), 'teacher'::app_role)
    OR student_in_user_school(student_id)
  );

DROP POLICY IF EXISTS "Student visibility scoped" ON public.students;
CREATE POLICY "Student visibility scoped" ON public.students
  FOR SELECT TO authenticated
  USING (
    (SELECT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role)))
    OR auth_user_id = (SELECT auth.uid())
    OR is_homeroom_of_classroom((SELECT auth.uid()), classroom_id)
    OR is_teacher_assigned_to_classroom((SELECT auth.uid()), classroom_id)
    OR ((SELECT has_role(auth.uid(), 'parent'::app_role))
        AND (parent_user_id = (SELECT auth.uid()) OR parent_user_id_2 = (SELECT auth.uid())))
  );

DROP POLICY IF EXISTS "Students can view their own record" ON public.students;
CREATE POLICY "Students can view their own record" ON public.students
  FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Observers can view" ON public.students;
CREATE POLICY "Observers can view" ON public.students
  FOR SELECT TO authenticated
  USING ((SELECT has_role(auth.uid(), 'observer'::app_role)));

DROP POLICY IF EXISTS "Observers can view" ON public.attendance;
CREATE POLICY "Observers can view" ON public.attendance
  FOR SELECT TO authenticated
  USING ((SELECT has_role(auth.uid(), 'observer'::app_role)));

DROP POLICY IF EXISTS "Parents view child attendance" ON public.attendance;
CREATE POLICY "Parents view child attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (is_parent_of((SELECT auth.uid()), student_id));

DROP POLICY IF EXISTS "Staff can delete attendance" ON public.attendance;
CREATE POLICY "Staff can delete attendance" ON public.attendance
  FOR DELETE TO authenticated
  USING ((SELECT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))));

DROP POLICY IF EXISTS "Staff can update attendance" ON public.attendance;
CREATE POLICY "Staff can update attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING ((SELECT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))));

DROP POLICY IF EXISTS "Staff can view attendance" ON public.attendance;
CREATE POLICY "Staff can view attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING ((SELECT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))));

DROP POLICY IF EXISTS "Students can view own attendance" ON public.attendance;
CREATE POLICY "Students can view own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Observers can view" ON public.enrollments;
CREATE POLICY "Observers can view" ON public.enrollments
  FOR SELECT TO authenticated
  USING ((SELECT has_role(auth.uid(), 'observer'::app_role)));

DROP POLICY IF EXISTS "Staff manage enrollments" ON public.enrollments;
CREATE POLICY "Staff manage enrollments" ON public.enrollments
  FOR ALL TO authenticated
  USING ((SELECT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))));

DROP POLICY IF EXISTS "Staff view all enrollments" ON public.enrollments;
CREATE POLICY "Staff view all enrollments" ON public.enrollments
  FOR SELECT TO authenticated
  USING ((SELECT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))));

DROP POLICY IF EXISTS "Students view own enrollments" ON public.enrollments;
CREATE POLICY "Students view own enrollments" ON public.enrollments
  FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = (SELECT auth.uid())));

ALTER FUNCTION public.line_vault_autofill_ay() SET search_path = public;
