
DROP POLICY IF EXISTS "teacher_or_admin_manage_ssc" ON public.subject_score_columns;
DROP POLICY IF EXISTS "teacher_or_admin_manage_ssc" ON public.subject_score_columns;
CREATE POLICY "teacher_or_admin_manage_ssc"
ON public.subject_score_columns FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR
  EXISTS (SELECT 1 FROM public.teacher_assignments ta JOIN public.personnel p ON p.id=ta.personnel_id
          WHERE ta.subject_id = subject_score_columns.subject_id AND p.user_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR
  EXISTS (SELECT 1 FROM public.teacher_assignments ta JOIN public.personnel p ON p.id=ta.personnel_id
          WHERE ta.subject_id = subject_score_columns.subject_id AND p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "teacher_or_admin_manage_sgc" ON public.subject_grading_config;
DROP POLICY IF EXISTS "teacher_or_admin_manage_sgc" ON public.subject_grading_config;
CREATE POLICY "teacher_or_admin_manage_sgc"
ON public.subject_grading_config FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR
  EXISTS (SELECT 1 FROM public.teacher_assignments ta JOIN public.personnel p ON p.id=ta.personnel_id
          WHERE ta.subject_id = subject_grading_config.subject_id AND p.user_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR
  EXISTS (SELECT 1 FROM public.teacher_assignments ta JOIN public.personnel p ON p.id=ta.personnel_id
          WHERE ta.subject_id = subject_grading_config.subject_id AND p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "teacher_or_admin_manage_si" ON public.subject_indicators;
DROP POLICY IF EXISTS "teacher_or_admin_manage_si" ON public.subject_indicators;
CREATE POLICY "teacher_or_admin_manage_si"
ON public.subject_indicators FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR
  EXISTS (SELECT 1 FROM public.teacher_assignments ta JOIN public.personnel p ON p.id=ta.personnel_id
          WHERE ta.subject_id = subject_indicators.subject_id AND p.user_id = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR
  EXISTS (SELECT 1 FROM public.teacher_assignments ta JOIN public.personnel p ON p.id=ta.personnel_id
          WHERE ta.subject_id = subject_indicators.subject_id AND p.user_id = auth.uid())
);
