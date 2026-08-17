
-- Restrict hub_project_* SELECT to staff roles (admin/director/teacher)
DROP POLICY IF EXISTS "view budgets via project" ON public.hub_project_budgets;
DROP POLICY IF EXISTS "Staff view hub project budgets" ON public.hub_project_budgets;
CREATE POLICY "Staff view hub project budgets" ON public.hub_project_budgets
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

DROP POLICY IF EXISTS "view expenses via project" ON public.hub_project_expenses;
DROP POLICY IF EXISTS "Staff view hub project expenses" ON public.hub_project_expenses;
CREATE POLICY "Staff view hub project expenses" ON public.hub_project_expenses
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );

DROP POLICY IF EXISTS "view updates via project" ON public.hub_project_updates;
DROP POLICY IF EXISTS "Authenticated view published or staff view all updates" ON public.hub_project_updates;
CREATE POLICY "Authenticated view published or staff view all updates"
  ON public.hub_project_updates
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  );
