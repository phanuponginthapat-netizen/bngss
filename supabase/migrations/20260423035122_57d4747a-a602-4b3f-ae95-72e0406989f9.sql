
-- ============================================================
-- Tighten RLS on sensitive tables and Realtime publication
-- ============================================================

-- ===== home_visits =====
DROP POLICY IF EXISTS "Auth users can view home_visits" ON public.home_visits;

DROP POLICY IF EXISTS "Students can view their own home visits" ON public.home_visits;
CREATE POLICY "Students can view their own home visits"
  ON public.home_visits FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Parents can view linked student home visits" ON public.home_visits;
CREATE POLICY "Parents can view linked student home visits"
  ON public.home_visits FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'parent'::app_role)
    AND student_id IN (SELECT student_id FROM public.parent_student_links WHERE parent_user_id = auth.uid())
  );

-- ===== health_records =====
DROP POLICY IF EXISTS "Auth users can view health_records" ON public.health_records;

DROP POLICY IF EXISTS "Students can view their own health records" ON public.health_records;
CREATE POLICY "Students can view their own health records"
  ON public.health_records FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Parents can view linked student health records" ON public.health_records;
CREATE POLICY "Parents can view linked student health records"
  ON public.health_records FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'parent'::app_role)
    AND student_id IN (SELECT student_id FROM public.parent_student_links WHERE parent_user_id = auth.uid())
  );

-- ===== sdq_records =====
DROP POLICY IF EXISTS "Auth users can view sdq_records" ON public.sdq_records;

DROP POLICY IF EXISTS "Students can view their own sdq records" ON public.sdq_records;
CREATE POLICY "Students can view their own sdq records"
  ON public.sdq_records FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Parents can view linked student sdq records" ON public.sdq_records;
CREATE POLICY "Parents can view linked student sdq records"
  ON public.sdq_records FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'parent'::app_role)
    AND student_id IN (SELECT student_id FROM public.parent_student_links WHERE parent_user_id = auth.uid())
  );

-- ===== staff_leaves =====
DROP POLICY IF EXISTS "Auth users manage staff_leaves" ON public.staff_leaves;

DROP POLICY IF EXISTS "Admin/director manage staff_leaves" ON public.staff_leaves;
CREATE POLICY "Admin/director manage staff_leaves"
  ON public.staff_leaves FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

DROP POLICY IF EXISTS "Staff can view their own leaves" ON public.staff_leaves;
CREATE POLICY "Staff can view their own leaves"
  ON public.staff_leaves FOR SELECT TO authenticated
  USING (personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff can request their own leaves" ON public.staff_leaves;
CREATE POLICY "Staff can request their own leaves"
  ON public.staff_leaves FOR INSERT TO authenticated
  WITH CHECK (personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Staff can update their own leaves" ON public.staff_leaves;
CREATE POLICY "Staff can update their own leaves"
  ON public.staff_leaves FOR UPDATE TO authenticated
  USING (personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()))
  WITH CHECK (personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()));

-- ===== student_leaves =====
DROP POLICY IF EXISTS "Auth users manage student_leaves" ON public.student_leaves;

DROP POLICY IF EXISTS "Staff manage student_leaves" ON public.student_leaves;
CREATE POLICY "Staff manage student_leaves"
  ON public.student_leaves FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Students can view their own leaves" ON public.student_leaves;
CREATE POLICY "Students can view their own leaves"
  ON public.student_leaves FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Students can request their own leaves" ON public.student_leaves;
CREATE POLICY "Students can request their own leaves"
  ON public.student_leaves FOR INSERT TO authenticated
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));

-- ===== student_scores (uses student_code text) =====
DROP POLICY IF EXISTS "Authenticated users can view scores" ON public.student_scores;
DROP POLICY IF EXISTS "Authenticated users can insert scores" ON public.student_scores;
DROP POLICY IF EXISTS "Authenticated users can update scores" ON public.student_scores;
DROP POLICY IF EXISTS "Authenticated users can delete scores" ON public.student_scores;

DROP POLICY IF EXISTS "Staff manage student_scores" ON public.student_scores;
CREATE POLICY "Staff manage student_scores"
  ON public.student_scores FOR ALL TO authenticated
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

DROP POLICY IF EXISTS "Students view their own scores" ON public.student_scores;
CREATE POLICY "Students view their own scores"
  ON public.student_scores FOR SELECT TO authenticated
  USING (student_code IN (SELECT student_code FROM public.students WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "Parents view linked student scores" ON public.student_scores;
CREATE POLICY "Parents view linked student scores"
  ON public.student_scores FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'parent'::app_role)
    AND student_code IN (
      SELECT s.student_code FROM public.students s
      JOIN public.parent_student_links psl ON psl.student_id = s.id
      WHERE psl.parent_user_id = auth.uid()
    )
  );

-- ===== subjects =====
DROP POLICY IF EXISTS "Authenticated users can insert subjects" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated users can update subjects" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated users can delete subjects" ON public.subjects;

DROP POLICY IF EXISTS "Staff can insert subjects" ON public.subjects;
CREATE POLICY "Staff can insert subjects"
  ON public.subjects FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

DROP POLICY IF EXISTS "Staff can update subjects" ON public.subjects;
CREATE POLICY "Staff can update subjects"
  ON public.subjects FOR UPDATE TO authenticated
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

DROP POLICY IF EXISTS "Admin/director can delete subjects" ON public.subjects;
CREATE POLICY "Admin/director can delete subjects"
  ON public.subjects FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  );

-- ===== Realtime publication: drop sensitive tables =====
ALTER PUBLICATION supabase_realtime DROP TABLE public.health_records;
ALTER PUBLICATION supabase_realtime DROP TABLE public.home_visits;
ALTER PUBLICATION supabase_realtime DROP TABLE public.sdq_records;
ALTER PUBLICATION supabase_realtime DROP TABLE public.student_scores;
ALTER PUBLICATION supabase_realtime DROP TABLE public.staff_leaves;
ALTER PUBLICATION supabase_realtime DROP TABLE public.student_leaves;
