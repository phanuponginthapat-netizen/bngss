-- student_leaves: staff access
DROP POLICY IF EXISTS "Staff manage student leaves" ON public.student_leaves;
DROP POLICY IF EXISTS "Staff manage student leaves" ON public.student_leaves;
CREATE POLICY "Staff manage student leaves" ON public.student_leaves
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'));

-- staff_leaves: personnel dept head can approve/manage
DROP POLICY IF EXISTS "Personnel head manage staff leaves" ON public.staff_leaves;
DROP POLICY IF EXISTS "Personnel head manage staff leaves" ON public.staff_leaves;
CREATE POLICY "Personnel head manage staff leaves" ON public.staff_leaves
FOR ALL TO authenticated
USING (has_dept_position(auth.uid(),'personnel','head'))
WITH CHECK (has_dept_position(auth.uid(),'personnel','head'));

-- substitute_teaching: admin/director manage (auto-created on leave approval)
DROP POLICY IF EXISTS "Admins manage substitute teaching" ON public.substitute_teaching;
DROP POLICY IF EXISTS "Admins manage substitute teaching" ON public.substitute_teaching;
CREATE POLICY "Admins manage substitute teaching" ON public.substitute_teaching
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

-- teachers can view substitute assignments
DROP POLICY IF EXISTS "Teachers view substitute teaching" ON public.substitute_teaching;
DROP POLICY IF EXISTS "Teachers view substitute teaching" ON public.substitute_teaching;
CREATE POLICY "Teachers view substitute teaching" ON public.substitute_teaching
FOR SELECT TO authenticated
USING (has_role(auth.uid(),'teacher'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_leaves TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_leaves TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.substitute_teaching TO authenticated;
GRANT ALL ON public.student_leaves TO service_role;
GRANT ALL ON public.staff_leaves TO service_role;
GRANT ALL ON public.substitute_teaching TO service_role;