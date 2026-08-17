
-- Drop overly-permissive policies
DROP POLICY IF EXISTS "Loans managed by staff" ON public.ict_loans;
DROP POLICY IF EXISTS "Loans viewable by staff student or personnel" ON public.ict_loans;
DROP POLICY IF EXISTS "Students can create their own loans" ON public.ict_loans;
DROP POLICY IF EXISTS "Students can update their own loans" ON public.ict_loans;

-- SELECT: admin/director see all; borrower sees own
DROP POLICY IF EXISTS "ict_loans_select_admin_director" ON public.ict_loans;
DROP POLICY IF EXISTS "ict_loans_select_admin_director" ON public.ict_loans;
CREATE POLICY "ict_loans_select_admin_director"
  ON public.ict_loans FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'director')
  );

DROP POLICY IF EXISTS "ict_loans_select_own_borrower" ON public.ict_loans;
DROP POLICY IF EXISTS "ict_loans_select_own_borrower" ON public.ict_loans;
CREATE POLICY "ict_loans_select_own_borrower"
  ON public.ict_loans FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = ict_loans.personnel_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = ict_loans.student_id AND s.auth_user_id = auth.uid())
  );

-- INSERT: admin/director, or teacher creating a loan
DROP POLICY IF EXISTS "ict_loans_insert_staff" ON public.ict_loans;
DROP POLICY IF EXISTS "ict_loans_insert_staff" ON public.ict_loans;
CREATE POLICY "ict_loans_insert_staff"
  ON public.ict_loans FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'director') OR
    public.has_role(auth.uid(), 'teacher')
  );

-- UPDATE: admin/director, or the borrower themselves (return their own)
DROP POLICY IF EXISTS "ict_loans_update_admin_director" ON public.ict_loans;
DROP POLICY IF EXISTS "ict_loans_update_admin_director" ON public.ict_loans;
CREATE POLICY "ict_loans_update_admin_director"
  ON public.ict_loans FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'director')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'director')
  );

DROP POLICY IF EXISTS "ict_loans_update_own_borrower" ON public.ict_loans;
DROP POLICY IF EXISTS "ict_loans_update_own_borrower" ON public.ict_loans;
CREATE POLICY "ict_loans_update_own_borrower"
  ON public.ict_loans FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = ict_loans.personnel_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = ict_loans.student_id AND s.auth_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = ict_loans.personnel_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = ict_loans.student_id AND s.auth_user_id = auth.uid())
  );

-- DELETE: admin/director only
DROP POLICY IF EXISTS "ict_loans_delete_admin_director" ON public.ict_loans;
DROP POLICY IF EXISTS "ict_loans_delete_admin_director" ON public.ict_loans;
CREATE POLICY "ict_loans_delete_admin_director"
  ON public.ict_loans FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'director')
  );
