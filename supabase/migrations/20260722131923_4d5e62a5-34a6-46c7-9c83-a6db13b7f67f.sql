
-- Restore staff/admin visibility on core tables (broken by prior consolidation)

-- students
CREATE POLICY "Staff can view all students" ON public.students FOR SELECT TO authenticated USING (public.is_staff_user(auth.uid()));
CREATE POLICY "Admins manage students" ON public.students FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- personnel
CREATE POLICY "Staff can view personnel" ON public.personnel FOR SELECT TO authenticated USING (public.is_staff_user(auth.uid()));
CREATE POLICY "Admins manage personnel" ON public.personnel FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- profiles
CREATE POLICY "Staff can view profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff_user(auth.uid()));
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- classrooms
CREATE POLICY "Admins manage classrooms" ON public.classrooms FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- attendance
CREATE POLICY "Staff view attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_staff_user(auth.uid()));
CREATE POLICY "Admins manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- enrollments
CREATE POLICY "Staff view enrollments" ON public.enrollments FOR SELECT TO authenticated USING (public.is_staff_user(auth.uid()));
CREATE POLICY "Admins manage enrollments" ON public.enrollments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- subjects
CREATE POLICY "Admins manage subjects" ON public.subjects FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- schedules
CREATE POLICY "Admins manage schedules" ON public.schedules FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
