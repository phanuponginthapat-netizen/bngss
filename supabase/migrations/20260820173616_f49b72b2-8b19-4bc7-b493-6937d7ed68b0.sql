
-- Allow regular staff/teachers (not only department members) to use these modules
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['asset_damage_reports','hub_project_budgets','hub_project_expenses','hub_projects','id_plan_records','mou_records','question_bank','sar_evidences'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS staff_read_%s ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY staff_read_%s ON public.%I FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))$p$, t, t);
    EXECUTE format('DROP POLICY IF EXISTS staff_write_%s ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY staff_write_%s ON public.%I FOR INSERT TO authenticated
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))$p$, t, t);
    EXECUTE format('DROP POLICY IF EXISTS staff_update_%s ON public.%I', t, t);
    EXECUTE format($p$CREATE POLICY staff_update_%s ON public.%I FOR UPDATE TO authenticated
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))$p$, t, t);
  END LOOP;
END $$;

-- staff_evaluations stays restricted (sensitive), but admins/directors must be able to manage it
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_evaluations TO authenticated;
GRANT ALL ON public.staff_evaluations TO service_role;
DROP POLICY IF EXISTS staff_evaluations_admin_manage ON public.staff_evaluations;
CREATE POLICY staff_evaluations_admin_manage ON public.staff_evaluations
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
