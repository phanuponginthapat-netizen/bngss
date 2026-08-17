
-- Restore staff/admin visibility on core tables (broken by prior consolidation)

-- students
DROP POLICY IF EXISTS "Staff can view all students" ON public.students;
DROP POLICY IF EXISTS "Staff can view all students" ON public.students;
CREATE POLICY "Staff can view all students" ON public.students FOR SELECT TO authenticated USING (public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "Admins manage students" ON public.students;
DROP POLICY IF EXISTS "Admins manage students" ON public.students;
CREATE POLICY "Admins manage students" ON public.students FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- personnel
DROP POLICY IF EXISTS "Staff can view personnel" ON public.personnel;
DROP POLICY IF EXISTS "Staff can view personnel" ON public.personnel;
CREATE POLICY "Staff can view personnel" ON public.personnel FOR SELECT TO authenticated USING (public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "Admins manage personnel" ON public.personnel;
DROP POLICY IF EXISTS "Admins manage personnel" ON public.personnel;
CREATE POLICY "Admins manage personnel" ON public.personnel FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- profiles
DROP POLICY IF EXISTS "Staff can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Staff can view profiles" ON public.profiles;
CREATE POLICY "Staff can view profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON public.profiles;
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- classrooms
DROP POLICY IF EXISTS "Admins manage classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Admins manage classrooms" ON public.classrooms;
CREATE POLICY "Admins manage classrooms" ON public.classrooms FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- attendance
DROP POLICY IF EXISTS "Staff view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff view attendance" ON public.attendance;
CREATE POLICY "Staff view attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "Admins manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins manage attendance" ON public.attendance;
CREATE POLICY "Admins manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- enrollments
DROP POLICY IF EXISTS "Staff view enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Staff view enrollments" ON public.enrollments;
CREATE POLICY "Staff view enrollments" ON public.enrollments FOR SELECT TO authenticated USING (public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "Admins manage enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Admins manage enrollments" ON public.enrollments;
CREATE POLICY "Admins manage enrollments" ON public.enrollments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- subjects
DROP POLICY IF EXISTS "Admins manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins manage subjects" ON public.subjects;
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- schedules
DROP POLICY IF EXISTS "Admins manage schedules" ON public.schedules;
DROP POLICY IF EXISTS "Admins manage schedules" ON public.schedules;
CREATE POLICY "Admins manage schedules" ON public.schedules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
