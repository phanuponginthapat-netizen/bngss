
DROP POLICY IF EXISTS "ict_loans_block_students_from_personnel_loans_select" ON public.ict_loans;
CREATE POLICY "ict_loans_block_students_from_personnel_loans_select"
  ON public.ict_loans AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    personnel_id IS NULL
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.has_role(auth.uid(), 'teacher')
  );

DROP POLICY IF EXISTS "ict_loans_block_students_from_personnel_loans_update" ON public.ict_loans;
CREATE POLICY "ict_loans_block_students_from_personnel_loans_update"
  ON public.ict_loans AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    personnel_id IS NULL
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.has_role(auth.uid(), 'teacher')
  );
