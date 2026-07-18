-- Tighten RLS on students and student_subsidies tables.
-- Both currently use blanket "Auth users can manage" policies (USING true / WITH CHECK true)
-- which expose national IDs, parent contact info, biometric photos, and subsidy
-- eligibility to every authenticated user (including parents and students themselves).

-- ===== students =====
DROP POLICY IF EXISTS "Auth users can manage students" ON public.students;

-- Staff (admin, director, teacher) can fully manage student records
CREATE POLICY "Staff can manage students"
  ON public.students
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );

-- Students can view their own record (already partially covered by parent/staff policies; add explicit self-view)
CREATE POLICY "Students can view their own record"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Note: existing "Parents can view linked students" SELECT policy is preserved
-- (parents read-only via parent_student_links join).

-- ===== student_subsidies =====
DROP POLICY IF EXISTS "Auth users manage student_subsidies" ON public.student_subsidies;

-- Only staff can read/write subsidy/income eligibility data
CREATE POLICY "Staff can manage student_subsidies"
  ON public.student_subsidies
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );

-- Parents may view subsidy status of their linked students (read-only)
CREATE POLICY "Parents can view linked student subsidies"
  ON public.student_subsidies
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'parent'::app_role)
    AND student_id IN (
      SELECT psl.student_id FROM public.parent_student_links psl
      WHERE psl.parent_user_id = auth.uid()
    )
  );