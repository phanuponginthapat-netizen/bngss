-- Allow students to self-borrow and self-return ICT items
DROP POLICY IF EXISTS "Students can create their own loans" ON public.ict_loans;
CREATE POLICY "Students can create their own loans"
  ON public.ict_loans FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = ict_loans.student_id AND s.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can update their own loans" ON public.ict_loans;
CREATE POLICY "Students can update their own loans"
  ON public.ict_loans FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = ict_loans.student_id AND s.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = ict_loans.student_id AND s.auth_user_id = auth.uid()
    )
  );