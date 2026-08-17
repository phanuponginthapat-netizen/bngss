
-- Homework assignments school scope
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.homework_assignments;
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.homework_assignments;
CREATE POLICY "school_scope_restrictive" ON public.homework_assignments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))));

-- Hub projects family school scope
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_projects;
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_projects;
CREATE POLICY "school_scope_restrictive" ON public.hub_projects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))));

DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_budgets;
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_budgets;
CREATE POLICY "school_scope_restrictive" ON public.hub_project_budgets
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))));

DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_expenses;
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_expenses;
CREATE POLICY "school_scope_restrictive" ON public.hub_project_expenses
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))));

DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_updates;
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.hub_project_updates;
CREATE POLICY "school_scope_restrictive" ON public.hub_project_updates
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))))
  WITH CHECK ((school_id IS NULL) OR (school_id = (SELECT get_user_school_id(auth.uid()))));

-- print_template_versions: restrict read
DROP POLICY IF EXISTS "Auth read versions" ON public.print_template_versions;
DROP POLICY IF EXISTS "Admins/directors or template updater read versions" ON public.print_template_versions;
DROP POLICY IF EXISTS "Admins/directors or template updater read versions" ON public.print_template_versions;
CREATE POLICY "Admins/directors or template updater read versions"
  ON public.print_template_versions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'director'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.print_templates t
      WHERE t.id = print_template_versions.template_id
        AND t.updated_by = auth.uid()
    )
  );
