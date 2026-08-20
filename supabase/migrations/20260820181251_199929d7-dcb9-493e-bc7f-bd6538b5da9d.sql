DROP POLICY IF EXISTS school_scope_restrictive ON public.asset_damage_reports;
CREATE POLICY school_scope_restrictive ON public.asset_damage_reports AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_damage_reports.asset_id AND (a.school_id IS NULL OR a.school_id = public.get_user_school_id(auth.uid()))) OR asset_id IS NULL)
WITH CHECK (EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_damage_reports.asset_id AND (a.school_id IS NULL OR a.school_id = public.get_user_school_id(auth.uid()))) OR asset_id IS NULL);

DROP POLICY IF EXISTS school_scope_restrictive ON public.hub_project_budgets;
CREATE POLICY school_scope_restrictive ON public.hub_project_budgets AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.hub_projects p WHERE p.id = hub_project_budgets.project_id AND (p.school_id IS NULL OR p.school_id = public.get_user_school_id(auth.uid()))) OR project_id IS NULL)
WITH CHECK (EXISTS (SELECT 1 FROM public.hub_projects p WHERE p.id = hub_project_budgets.project_id AND (p.school_id IS NULL OR p.school_id = public.get_user_school_id(auth.uid()))) OR project_id IS NULL);

DROP POLICY IF EXISTS school_scope_restrictive ON public.hub_project_expenses;
CREATE POLICY school_scope_restrictive ON public.hub_project_expenses AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.hub_projects p WHERE p.id = hub_project_expenses.project_id AND (p.school_id IS NULL OR p.school_id = public.get_user_school_id(auth.uid()))) OR project_id IS NULL)
WITH CHECK (EXISTS (SELECT 1 FROM public.hub_projects p WHERE p.id = hub_project_expenses.project_id AND (p.school_id IS NULL OR p.school_id = public.get_user_school_id(auth.uid()))) OR project_id IS NULL);

DROP POLICY IF EXISTS school_scope_restrictive ON public.id_plan_records;
CREATE POLICY school_scope_restrictive ON public.id_plan_records AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.personnel pe WHERE pe.id = id_plan_records.personnel_id AND (pe.school_id IS NULL OR pe.school_id = public.get_user_school_id(auth.uid()))) OR personnel_id IS NULL)
WITH CHECK (EXISTS (SELECT 1 FROM public.personnel pe WHERE pe.id = id_plan_records.personnel_id AND (pe.school_id IS NULL OR pe.school_id = public.get_user_school_id(auth.uid()))) OR personnel_id IS NULL);

DROP POLICY IF EXISTS school_scope_restrictive ON public.mou_records;
CREATE POLICY school_scope_restrictive ON public.mou_records AS RESTRICTIVE FOR ALL TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
WITH CHECK (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));