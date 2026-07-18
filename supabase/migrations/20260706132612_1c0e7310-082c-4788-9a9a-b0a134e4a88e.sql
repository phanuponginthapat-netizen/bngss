-- === students ===
DROP POLICY IF EXISTS "Admin/Director can manage students" ON public.students;
DROP POLICY IF EXISTS "Homeroom teachers can update their students" ON public.students;
DROP POLICY IF EXISTS "Staff can view students in their school" ON public.students;
DROP POLICY IF EXISTS "Students can view their own record" ON public.students;

CREATE POLICY "Admin/Director can manage students" ON public.students
  FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role)) OR (SELECT public.has_role(auth.uid(), 'director'::app_role)))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin'::app_role)) OR (SELECT public.has_role(auth.uid(), 'director'::app_role)));

CREATE POLICY "Homeroom teachers can update their students" ON public.students
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_homeroom_of_classroom(auth.uid(), classroom_id)))
  WITH CHECK ((SELECT public.is_homeroom_of_classroom(auth.uid(), classroom_id)));

CREATE POLICY "Staff can view students in their school" ON public.students
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR (
      (SELECT public.has_role(auth.uid(), 'teacher'::app_role))
      AND (school_id IS NULL OR (SELECT public.get_user_school_id(auth.uid())) IS NULL OR school_id = (SELECT public.get_user_school_id(auth.uid())))
    )
  );

CREATE POLICY "Students can view their own record" ON public.students
  FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

-- === attendance ===
DROP POLICY IF EXISTS "Parents view child attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can delete attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Students can view own attendance" ON public.attendance;
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.attendance;
DROP POLICY IF EXISTS "school_scope_teacher" ON public.attendance;

CREATE POLICY "Parents view child attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING ((SELECT public.is_parent_of(auth.uid(), student_id)));

CREATE POLICY "Staff can delete attendance" ON public.attendance
  FOR DELETE TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR ((SELECT public.has_role(auth.uid(), 'teacher'::app_role)) AND (SELECT public.teacher_teaches_subject(auth.uid(), subject_id)))
  );

CREATE POLICY "Staff can insert attendance" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR ((SELECT public.has_role(auth.uid(), 'teacher'::app_role)) AND (SELECT public.teacher_teaches_subject(auth.uid(), subject_id)))
  );

CREATE POLICY "Staff can update attendance" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR ((SELECT public.has_role(auth.uid(), 'teacher'::app_role)) AND (SELECT public.teacher_teaches_subject(auth.uid(), subject_id)))
  )
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR ((SELECT public.has_role(auth.uid(), 'teacher'::app_role)) AND (SELECT public.teacher_teaches_subject(auth.uid(), subject_id)))
  );

CREATE POLICY "Staff can view attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'teacher'::app_role))
  );

CREATE POLICY "Students can view own attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = (SELECT auth.uid())));

CREATE POLICY "school_scope_restrictive" ON public.attendance
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (school_id IS NULL OR school_id = (SELECT public.get_user_school_id(auth.uid())))
  WITH CHECK (school_id IS NULL OR school_id = (SELECT public.get_user_school_id(auth.uid())));

CREATE POLICY "school_scope_teacher" ON public.attendance
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR NOT (SELECT public.has_role(auth.uid(), 'teacher'::app_role))
    OR (SELECT public.student_in_user_school(student_id))
  )
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR NOT (SELECT public.has_role(auth.uid(), 'teacher'::app_role))
    OR (SELECT public.student_in_user_school(student_id))
  );

-- === face_scan_logs ===
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.face_scan_logs;
DROP POLICY IF EXISTS "school_scope_teacher" ON public.face_scan_logs;
DROP POLICY IF EXISTS "staff manage scan logs" ON public.face_scan_logs;
DROP POLICY IF EXISTS "students view own scan logs" ON public.face_scan_logs;

CREATE POLICY "school_scope_restrictive" ON public.face_scan_logs
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (school_id IS NULL OR school_id = (SELECT public.get_user_school_id(auth.uid())))
  WITH CHECK (school_id IS NULL OR school_id = (SELECT public.get_user_school_id(auth.uid())));

CREATE POLICY "school_scope_teacher" ON public.face_scan_logs
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR NOT (SELECT public.has_role(auth.uid(), 'teacher'::app_role))
    OR (SELECT public.student_in_user_school(student_id))
  )
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR NOT (SELECT public.has_role(auth.uid(), 'teacher'::app_role))
    OR (SELECT public.student_in_user_school(student_id))
  );

CREATE POLICY "staff manage scan logs" ON public.face_scan_logs
  FOR ALL TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'teacher'::app_role))
  )
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'teacher'::app_role))
  );

CREATE POLICY "students view own scan logs" ON public.face_scan_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = face_scan_logs.student_id AND s.auth_user_id = (SELECT auth.uid())));

-- === personnel ===
DROP POLICY IF EXISTS "Admin/Director can manage personnel" ON public.personnel;
DROP POLICY IF EXISTS "Admins manage personnel inserts" ON public.personnel;
DROP POLICY IF EXISTS "Staff can view personnel" ON public.personnel;
DROP POLICY IF EXISTS "Users can update their own personnel record" ON public.personnel;

CREATE POLICY "Admin/Director can manage personnel" ON public.personnel
  FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role)) OR (SELECT public.has_role(auth.uid(), 'director'::app_role)))
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin'::app_role)) OR (SELECT public.has_role(auth.uid(), 'director'::app_role)));

CREATE POLICY "Admins manage personnel inserts" ON public.personnel
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role(auth.uid(), 'admin'::app_role)) OR (SELECT public.has_role(auth.uid(), 'director'::app_role)));

CREATE POLICY "Staff can view personnel" ON public.personnel
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'admin'::app_role))
    OR (SELECT public.has_role(auth.uid(), 'director'::app_role))
    OR (user_id = (SELECT auth.uid()))
    OR ((SELECT public.has_role(auth.uid(), 'teacher'::app_role)) AND (school_id IS NULL OR (SELECT public.get_user_school_id(auth.uid())) IS NULL OR school_id = (SELECT public.get_user_school_id(auth.uid()))))
  );

CREATE POLICY "Users can update their own personnel record" ON public.personnel
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));