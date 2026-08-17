-- ===== admissions: restrict SELECT to admin/director only =====
DROP POLICY IF EXISTS "Auth users can view admissions" ON public.admissions;

-- The existing "Admin/Director can manage admissions" ALL policy already covers SELECT for those roles.

-- ===== student_assessment_scores: replace permissive ALL policy =====
DROP POLICY IF EXISTS "Auth users manage student_assessment_scores" ON public.student_assessment_scores;
DROP POLICY IF EXISTS "Auth users can view student_assessment_scores" ON public.student_assessment_scores;
DROP POLICY IF EXISTS "Auth users can manage student_assessment_scores" ON public.student_assessment_scores;

DROP POLICY IF EXISTS "Staff manage student_assessment_scores" ON public.student_assessment_scores;
DROP POLICY IF EXISTS "Staff manage student_assessment_scores" ON public.student_assessment_scores;
CREATE POLICY "Staff manage student_assessment_scores"
  ON public.student_assessment_scores FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Students view own assessment scores" ON public.student_assessment_scores;
DROP POLICY IF EXISTS "Students view own assessment scores" ON public.student_assessment_scores;
CREATE POLICY "Students view own assessment scores"
  ON public.student_assessment_scores FOR SELECT TO authenticated
  USING (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Parents view linked student assessment scores" ON public.student_assessment_scores;
DROP POLICY IF EXISTS "Parents view linked student assessment scores" ON public.student_assessment_scores;
CREATE POLICY "Parents view linked student assessment scores"
  ON public.student_assessment_scores FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'parent'::app_role)
    AND student_id IN (
      SELECT student_id FROM public.parent_student_links WHERE parent_user_id = auth.uid()
    )
  );
