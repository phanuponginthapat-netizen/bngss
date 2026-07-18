
-- ===== subject_score_columns =====
DROP POLICY IF EXISTS "Auth users manage subject_score_columns" ON public.subject_score_columns;

CREATE POLICY "Anyone authenticated can view subject_score_columns"
  ON public.subject_score_columns FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff can insert subject_score_columns"
  ON public.subject_score_columns FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

CREATE POLICY "Staff can update subject_score_columns"
  ON public.subject_score_columns FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

CREATE POLICY "Staff can delete subject_score_columns"
  ON public.subject_score_columns FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

-- ===== student_column_scores =====
DROP POLICY IF EXISTS "Auth users manage student_column_scores" ON public.student_column_scores;

CREATE POLICY "Staff manage student_column_scores"
  ON public.student_column_scores FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

CREATE POLICY "Students view their own column scores"
  ON public.student_column_scores FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));

CREATE POLICY "Parents view linked student column scores"
  ON public.student_column_scores FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'parent'::app_role)
    AND student_id IN (
      SELECT student_id FROM public.parent_student_links WHERE parent_user_id = auth.uid()
    )
  );
