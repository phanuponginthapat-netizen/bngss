
-- RLS memoization pass 3: behavior_records, health_records, sdq_records, student_leaves, homework_submissions, notifications
-- Wrap auth.uid() and helper function calls in (SELECT ...) so Postgres caches per statement.

-- ===== behavior_records =====
DROP POLICY IF EXISTS "Parents view child behavior" ON public.behavior_records;
DROP POLICY IF EXISTS "Staff can manage behavior_records" ON public.behavior_records;
DROP POLICY IF EXISTS "Students view own behavior" ON public.behavior_records;
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.behavior_records;
DROP POLICY IF EXISTS "school_scope_teacher" ON public.behavior_records;

DROP POLICY IF EXISTS "Parents view child behavior" ON public.behavior_records;
CREATE POLICY "Parents view child behavior" ON public.behavior_records
FOR SELECT USING ((SELECT is_parent_of(auth.uid(), student_id)));

DROP POLICY IF EXISTS "Staff can manage behavior_records" ON public.behavior_records;
CREATE POLICY "Staff can manage behavior_records" ON public.behavior_records
FOR ALL
USING ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)))
WITH CHECK ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)));

DROP POLICY IF EXISTS "Students view own behavior" ON public.behavior_records;
CREATE POLICY "Students view own behavior" ON public.behavior_records
FOR SELECT USING (student_id IN (SELECT id FROM students WHERE auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "school_scope_restrictive" ON public.behavior_records;
CREATE POLICY "school_scope_restrictive" ON public.behavior_records
FOR ALL
USING (school_id IS NULL OR school_id = (SELECT get_user_school_id(auth.uid())))
WITH CHECK (school_id IS NULL OR school_id = (SELECT get_user_school_id(auth.uid())));

DROP POLICY IF EXISTS "school_scope_teacher" ON public.behavior_records;
CREATE POLICY "school_scope_teacher" ON public.behavior_records
FOR ALL
USING ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR NOT has_role(auth.uid(), 'teacher'::app_role)) OR (SELECT student_in_user_school(student_id)))
WITH CHECK ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR NOT has_role(auth.uid(), 'teacher'::app_role)) OR (SELECT student_in_user_school(student_id)));

-- ===== health_records =====
DROP POLICY IF EXISTS "Staff can manage health_records" ON public.health_records;
DROP POLICY IF EXISTS "Students can view their own health records" ON public.health_records;
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.health_records;
DROP POLICY IF EXISTS "school_scope_teacher" ON public.health_records;

DROP POLICY IF EXISTS "Staff can manage health_records" ON public.health_records;
CREATE POLICY "Staff can manage health_records" ON public.health_records
FOR ALL
USING ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)))
WITH CHECK ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)));

DROP POLICY IF EXISTS "Students can view their own health records" ON public.health_records;
CREATE POLICY "Students can view their own health records" ON public.health_records
FOR SELECT USING (student_id IN (SELECT id FROM students WHERE auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "school_scope_restrictive" ON public.health_records;
CREATE POLICY "school_scope_restrictive" ON public.health_records
FOR ALL
USING (school_id IS NULL OR school_id = (SELECT get_user_school_id(auth.uid())))
WITH CHECK (school_id IS NULL OR school_id = (SELECT get_user_school_id(auth.uid())));

DROP POLICY IF EXISTS "school_scope_teacher" ON public.health_records;
CREATE POLICY "school_scope_teacher" ON public.health_records
FOR ALL
USING ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR NOT has_role(auth.uid(), 'teacher'::app_role)) OR (SELECT student_in_user_school(student_id)))
WITH CHECK ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR NOT has_role(auth.uid(), 'teacher'::app_role)) OR (SELECT student_in_user_school(student_id)));

-- ===== sdq_records =====
DROP POLICY IF EXISTS "Staff can manage sdq_records" ON public.sdq_records;
DROP POLICY IF EXISTS "Students can view their own sdq records" ON public.sdq_records;
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.sdq_records;

DROP POLICY IF EXISTS "Staff can manage sdq_records" ON public.sdq_records;
CREATE POLICY "Staff can manage sdq_records" ON public.sdq_records
FOR ALL
USING ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)))
WITH CHECK ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)));

DROP POLICY IF EXISTS "Students can view their own sdq records" ON public.sdq_records;
CREATE POLICY "Students can view their own sdq records" ON public.sdq_records
FOR SELECT USING (student_id IN (SELECT id FROM students WHERE auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "school_scope_restrictive" ON public.sdq_records;
CREATE POLICY "school_scope_restrictive" ON public.sdq_records
FOR ALL
USING (school_id IS NULL OR school_id = (SELECT get_user_school_id(auth.uid())))
WITH CHECK (school_id IS NULL OR school_id = (SELECT get_user_school_id(auth.uid())));

-- ===== student_leaves =====
DROP POLICY IF EXISTS "Admin director manage student_leaves" ON public.student_leaves;
DROP POLICY IF EXISTS "Homeroom teacher manage student_leaves" ON public.student_leaves;
DROP POLICY IF EXISTS "Parents request child leaves" ON public.student_leaves;
DROP POLICY IF EXISTS "Parents view child leaves" ON public.student_leaves;
DROP POLICY IF EXISTS "Students can request their own leaves" ON public.student_leaves;
DROP POLICY IF EXISTS "Students can view their own leaves" ON public.student_leaves;

DROP POLICY IF EXISTS "Admin director manage student_leaves" ON public.student_leaves;
CREATE POLICY "Admin director manage student_leaves" ON public.student_leaves
FOR ALL
USING ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role)))
WITH CHECK ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role)));

DROP POLICY IF EXISTS "Homeroom teacher manage student_leaves" ON public.student_leaves;
CREATE POLICY "Homeroom teacher manage student_leaves" ON public.student_leaves
FOR ALL
USING ((SELECT has_role(auth.uid(), 'teacher'::app_role)) AND (SELECT is_homeroom_teacher_of_student(auth.uid(), student_id)))
WITH CHECK ((SELECT has_role(auth.uid(), 'teacher'::app_role)) AND (SELECT is_homeroom_teacher_of_student(auth.uid(), student_id)));

DROP POLICY IF EXISTS "Parents request child leaves" ON public.student_leaves;
CREATE POLICY "Parents request child leaves" ON public.student_leaves
FOR INSERT WITH CHECK ((SELECT is_parent_of(auth.uid(), student_id)));

DROP POLICY IF EXISTS "Parents view child leaves" ON public.student_leaves;
CREATE POLICY "Parents view child leaves" ON public.student_leaves
FOR SELECT USING ((SELECT is_parent_of(auth.uid(), student_id)));

DROP POLICY IF EXISTS "Students can request their own leaves" ON public.student_leaves;
CREATE POLICY "Students can request their own leaves" ON public.student_leaves
FOR INSERT WITH CHECK (student_id IN (SELECT id FROM students WHERE auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Students can view their own leaves" ON public.student_leaves;
CREATE POLICY "Students can view their own leaves" ON public.student_leaves
FOR SELECT USING (student_id IN (SELECT id FROM students WHERE auth_user_id = (SELECT auth.uid())));

-- ===== homework_submissions =====
DROP POLICY IF EXISTS "admins manage all submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "assignment owner can grade submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "assignment owner can view submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "students manage own submissions" ON public.homework_submissions;

DROP POLICY IF EXISTS "admins manage all submissions" ON public.homework_submissions;
CREATE POLICY "admins manage all submissions" ON public.homework_submissions
FOR ALL
USING ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role)))
WITH CHECK ((SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role)));

DROP POLICY IF EXISTS "assignment owner can grade submissions" ON public.homework_submissions;
CREATE POLICY "assignment owner can grade submissions" ON public.homework_submissions
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM homework_assignments a
    WHERE a.id = homework_submissions.assignment_id
      AND (a.created_by = (SELECT auth.uid()) OR (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role)))
  )
);

DROP POLICY IF EXISTS "assignment owner can view submissions" ON public.homework_submissions;
CREATE POLICY "assignment owner can view submissions" ON public.homework_submissions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM homework_assignments a
    WHERE a.id = homework_submissions.assignment_id
      AND (a.created_by = (SELECT auth.uid()) OR (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role)))
  )
);

DROP POLICY IF EXISTS "students manage own submissions" ON public.homework_submissions;
CREATE POLICY "students manage own submissions" ON public.homework_submissions
FOR ALL
USING (student_id IN (SELECT s.id FROM students s WHERE s.auth_user_id = (SELECT auth.uid())))
WITH CHECK (student_id IN (SELECT s.id FROM students s WHERE s.auth_user_id = (SELECT auth.uid())));

-- ===== notifications =====
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users insert own notifications or admin insert any" ON public.notifications;

DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
CREATE POLICY "Admins can manage all notifications" ON public.notifications
FOR ALL
USING ((SELECT has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK ((SELECT has_role(auth.uid(), 'admin'::app_role)));

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications" ON public.notifications
FOR DELETE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users insert own notifications or admin insert any" ON public.notifications;
CREATE POLICY "Users insert own notifications or admin insert any" ON public.notifications
FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role)));
