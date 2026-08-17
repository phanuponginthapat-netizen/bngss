-- Enrollments
DROP POLICY IF EXISTS "Students view own enrollments" ON public.enrollments;
CREATE POLICY "Students view own enrollments" ON public.enrollments
  FOR SELECT USING (
    student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Staff view all enrollments" ON public.enrollments;
CREATE POLICY "Staff view all enrollments" ON public.enrollments
  FOR SELECT USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')
  );
DROP POLICY IF EXISTS "Staff manage enrollments" ON public.enrollments;
CREATE POLICY "Staff manage enrollments" ON public.enrollments
  FOR ALL USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')
  );

-- Documents
DROP POLICY IF EXISTS "Staff manage documents" ON public.documents;
CREATE POLICY "Staff manage documents" ON public.documents
  FOR ALL USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')
  );
DROP POLICY IF EXISTS "Teachers view documents" ON public.documents;
CREATE POLICY "Teachers view documents" ON public.documents
  FOR SELECT USING (public.has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "Recipients view their documents" ON public.documents;
CREATE POLICY "Recipients view their documents" ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.document_recipients dr
      WHERE dr.document_id = documents.id AND dr.recipient_user_id = auth.uid()
    )
  );

-- Budget
DROP POLICY IF EXISTS "Admin/Director manage budget" ON public.budget_transactions;
CREATE POLICY "Admin/Director manage budget" ON public.budget_transactions
  FOR ALL USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')
  );

-- Academic events
DROP POLICY IF EXISTS "Auth users view academic events" ON public.academic_events;
CREATE POLICY "Auth users view academic events" ON public.academic_events
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Staff manage academic events" ON public.academic_events;
CREATE POLICY "Staff manage academic events" ON public.academic_events
  FOR ALL USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')
  );