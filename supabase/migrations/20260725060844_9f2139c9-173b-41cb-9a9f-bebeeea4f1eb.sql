
-- Allow subject teachers (and admin/director) to write scores + delete attendance
DROP POLICY IF EXISTS "teacher_or_admin_manage_scs" ON public.student_column_scores;
CREATE POLICY "teacher_or_admin_manage_scs" ON public.student_column_scores
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role)
    OR EXISTS (
      SELECT 1 FROM subject_score_columns c
      JOIN teacher_assignments ta ON ta.subject_id = c.subject_id
      JOIN personnel p ON p.id = ta.personnel_id
      WHERE c.id = student_column_scores.column_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role)
    OR EXISTS (
      SELECT 1 FROM subject_score_columns c
      JOIN teacher_assignments ta ON ta.subject_id = c.subject_id
      JOIN personnel p ON p.id = ta.personnel_id
      WHERE c.id = student_column_scores.column_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers and directors delete attendance" ON public.attendance;
CREATE POLICY "Teachers and directors delete attendance" ON public.attendance
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'director'::app_role) OR has_role(auth.uid(),'admin'::app_role));
