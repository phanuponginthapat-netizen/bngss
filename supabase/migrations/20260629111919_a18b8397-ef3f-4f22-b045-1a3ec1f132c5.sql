
-- === enrollments ===
DROP POLICY IF EXISTS "Observers can view" ON public.enrollments;
DROP POLICY IF EXISTS "Staff manage enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Staff view all enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Students view own enrollments" ON public.enrollments;

CREATE POLICY "Observers can view" ON public.enrollments FOR SELECT
USING ((SELECT public.has_role(auth.uid(), 'observer'::app_role)));

CREATE POLICY "Staff manage enrollments" ON public.enrollments FOR ALL
USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role)));

CREATE POLICY "Staff view all enrollments" ON public.enrollments FOR SELECT
USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role)));

CREATE POLICY "Students view own enrollments" ON public.enrollments FOR SELECT
USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = (SELECT auth.uid())));

-- === attendance ===
DROP POLICY IF EXISTS "Observers can view" ON public.attendance;
DROP POLICY IF EXISTS "Parents view child attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can delete attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "school_scope_teacher" ON public.attendance;

CREATE POLICY "Observers can view" ON public.attendance FOR SELECT
USING ((SELECT public.has_role(auth.uid(), 'observer'::app_role)));

CREATE POLICY "Parents view child attendance" ON public.attendance FOR SELECT
USING (public.is_parent_of((SELECT auth.uid()), student_id));

CREATE POLICY "Staff can delete attendance" ON public.attendance FOR DELETE
USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role)));

CREATE POLICY "Staff can update attendance" ON public.attendance FOR UPDATE
USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role)));

CREATE POLICY "Staff can view attendance" ON public.attendance FOR SELECT
USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role)));

CREATE POLICY "Students can view own attendance" ON public.attendance FOR SELECT
USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = (SELECT auth.uid())));

CREATE POLICY "school_scope_teacher" ON public.attendance FOR ALL
USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR NOT public.has_role(auth.uid(), 'teacher'::app_role)) OR public.student_in_user_school(student_id));

-- === students ===
DROP POLICY IF EXISTS "Admin/Director can manage students" ON public.students;
DROP POLICY IF EXISTS "Homeroom teachers can update their students" ON public.students;
DROP POLICY IF EXISTS "Observers can view" ON public.students;
DROP POLICY IF EXISTS "Student visibility scoped" ON public.students;
DROP POLICY IF EXISTS "Students can view their own record" ON public.students;

CREATE POLICY "Admin/Director can manage students" ON public.students FOR ALL
USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role)));

CREATE POLICY "Homeroom teachers can update their students" ON public.students FOR UPDATE
USING (public.is_homeroom_of_classroom((SELECT auth.uid()), classroom_id));

CREATE POLICY "Observers can view" ON public.students FOR SELECT
USING ((SELECT public.has_role(auth.uid(), 'observer'::app_role)));

CREATE POLICY "Student visibility scoped" ON public.students FOR SELECT
USING (
  (SELECT public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
  OR auth_user_id = (SELECT auth.uid())
  OR public.is_homeroom_of_classroom((SELECT auth.uid()), classroom_id)
  OR public.is_teacher_assigned_to_classroom((SELECT auth.uid()), classroom_id)
  OR ((SELECT public.has_role(auth.uid(), 'parent'::app_role)) AND (parent_user_id = (SELECT auth.uid()) OR parent_user_id_2 = (SELECT auth.uid())))
);

CREATE POLICY "Students can view their own record" ON public.students FOR SELECT
USING (auth_user_id = (SELECT auth.uid()));
