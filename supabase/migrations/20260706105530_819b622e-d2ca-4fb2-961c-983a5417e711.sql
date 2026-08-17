
DROP POLICY IF EXISTS "All authenticated can read fill history" ON public.template_fill_history;
DROP POLICY IF EXISTS "Own or admin read fill history" ON public.template_fill_history;
CREATE POLICY "Own or admin read fill history"
ON public.template_fill_history FOR SELECT TO authenticated
USING (filled_by = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role));

DROP POLICY IF EXISTS "scores_read_all_auth" ON public.game_hub_scores;
DROP POLICY IF EXISTS "scores_read_same_school" ON public.game_hub_scores;
CREATE POLICY "scores_read_same_school"
ON public.game_hub_scores FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR auth_user_id = auth.uid()
  OR (student_id IS NOT NULL AND public.student_in_user_school(student_id))
);

DROP POLICY IF EXISTS "Authenticated users can view iot readings" ON public.iot_readings;
DROP POLICY IF EXISTS "Staff can view iot readings" ON public.iot_readings;
CREATE POLICY "Staff can view iot readings"
ON public.iot_readings FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role) OR has_role(auth.uid(),'teacher'::app_role));

DROP POLICY IF EXISTS "Auth users view schools" ON public.schools;
DROP POLICY IF EXISTS "Authenticated view schools" ON public.schools;
DROP POLICY IF EXISTS "Own school or admin" ON public.schools;
CREATE POLICY "Own school or admin"
ON public.schools FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Authenticated view subject_indicators" ON public.subject_indicators;
DROP POLICY IF EXISTS "View subject_indicators same school" ON public.subject_indicators;
CREATE POLICY "View subject_indicators same school"
ON public.subject_indicators FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_indicators.subject_id AND s.school_id = public.get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Anyone authenticated can view subject_score_columns" ON public.subject_score_columns;
DROP POLICY IF EXISTS "View subject_score_columns same school" ON public.subject_score_columns;
CREATE POLICY "View subject_score_columns same school"
ON public.subject_score_columns FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = subject_score_columns.subject_id AND s.school_id = public.get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Authenticated view teacher_assignments" ON public.teacher_assignments;
DROP POLICY IF EXISTS "View teacher_assignments same school" ON public.teacher_assignments;
CREATE POLICY "View teacher_assignments same school"
ON public.teacher_assignments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = teacher_assignments.subject_id AND s.school_id = public.get_user_school_id(auth.uid()))
);
