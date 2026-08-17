
-- behavior_records
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.behavior_records;
DROP POLICY IF EXISTS "school_scope_teacher" ON public.behavior_records;
CREATE POLICY "school_scope_restrictive" ON public.behavior_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))));
CREATE POLICY "school_scope_teacher" ON public.behavior_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role) OR (NOT has_role(auth.uid(),'teacher'::app_role))))
    OR (SELECT student_in_user_school(behavior_records.student_id))
  )
  WITH CHECK (
    (SELECT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role) OR (NOT has_role(auth.uid(),'teacher'::app_role))))
    OR (SELECT student_in_user_school(behavior_records.student_id))
  );

-- health_records
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.health_records;
DROP POLICY IF EXISTS "school_scope_teacher" ON public.health_records;
CREATE POLICY "school_scope_restrictive" ON public.health_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))));
CREATE POLICY "school_scope_teacher" ON public.health_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    (SELECT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role) OR (NOT has_role(auth.uid(),'teacher'::app_role))))
    OR (SELECT student_in_user_school(health_records.student_id))
  )
  WITH CHECK (
    (SELECT (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role) OR (NOT has_role(auth.uid(),'teacher'::app_role))))
    OR (SELECT student_in_user_school(health_records.student_id))
  );

-- sdq_records
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.sdq_records;
CREATE POLICY "school_scope_restrictive" ON public.sdq_records
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))));

-- exam_submissions
DROP POLICY IF EXISTS "exam_submissions teacher" ON public.exam_submissions;
CREATE POLICY "exam_submissions teacher" ON public.exam_submissions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_submissions.exam_id
      AND (e.teacher_id = auth.uid()
           OR has_role(auth.uid(),'admin'::app_role)
           OR has_role(auth.uid(),'director'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM exams e
    WHERE e.id = exam_submissions.exam_id
      AND (e.teacher_id = auth.uid()
           OR has_role(auth.uid(),'admin'::app_role)
           OR has_role(auth.uid(),'director'::app_role))
  ));

-- print_templates: restrict blanket read
DROP POLICY IF EXISTS "Anyone authenticated can read active templates" ON public.print_templates;
DROP POLICY IF EXISTS "Authenticated can read active templates" ON public.print_templates;
CREATE POLICY "Authenticated can read active templates" ON public.print_templates
  FOR SELECT TO authenticated
  USING (
    COALESCE(is_active, false) = true
    OR updated_by = auth.uid()
    OR has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'director'::app_role)
  );
