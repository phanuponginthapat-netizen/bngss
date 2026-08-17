
-- 1) chat_reports: constrain admin updates with WITH CHECK
DROP POLICY IF EXISTS "admin updates reports" ON public.chat_reports;
CREATE POLICY "admin updates reports" ON public.chat_reports
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND reporter_id = (SELECT reporter_id FROM public.chat_reports r WHERE r.id = chat_reports.id)
  );

-- 2) game_hub_scores: replace open SELECT with scoped policy
DROP POLICY IF EXISTS "scores_read_all_auth" ON public.game_hub_scores;

DROP POLICY IF EXISTS "scores_read_own" ON public.game_hub_scores;
CREATE POLICY "scores_read_own" ON public.game_hub_scores
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "scores_read_staff_same_school" ON public.game_hub_scores;
CREATE POLICY "scores_read_staff_same_school" ON public.game_hub_scores
  FOR SELECT TO authenticated
  USING (
    (has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'teacher'::app_role)
     OR has_role(auth.uid(), 'director'::app_role)
     OR has_role(auth.uid(), 'super_admin'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = game_hub_scores.student_id
        AND s.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  );
