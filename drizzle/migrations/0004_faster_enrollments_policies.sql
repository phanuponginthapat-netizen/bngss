DROP POLICY IF EXISTS "Admins manage enrollments" ON public.enrollments;
CREATE POLICY "Admins manage enrollments" ON public.enrollments FOR ALL TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));
DROP POLICY IF EXISTS "Parents view child enrollments" ON public.enrollments;
CREATE POLICY "Parents view child enrollments" ON public.enrollments FOR SELECT TO authenticated
  USING (student_id = ANY (ARRAY(SELECT unnest(public.parent_child_ids((SELECT auth.uid()))))));
DROP POLICY IF EXISTS "Staff view enrollments" ON public.enrollments;
CREATE POLICY "Staff view enrollments" ON public.enrollments FOR SELECT TO authenticated
  USING ((SELECT public.is_staff_user((SELECT auth.uid()))));
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.enrollments;
CREATE POLICY "school_scope_restrictive" ON public.enrollments AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT public.get_user_school_id((SELECT auth.uid())))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT public.get_user_school_id((SELECT auth.uid())))));
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);