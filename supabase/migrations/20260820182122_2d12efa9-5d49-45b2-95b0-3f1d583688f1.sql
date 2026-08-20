DROP POLICY IF EXISTS school_scope_restrictive ON public.sar_evidences;
CREATE POLICY school_scope_restrictive ON public.sar_evidences AS RESTRICTIVE FOR ALL TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
WITH CHECK (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS school_scope_restrictive ON public.staff_evaluations;
CREATE POLICY school_scope_restrictive ON public.staff_evaluations AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.personnel pe WHERE pe.id = staff_evaluations.personnel_id AND (pe.school_id IS NULL OR pe.school_id = public.get_user_school_id(auth.uid()))) OR personnel_id IS NULL)
WITH CHECK (EXISTS (SELECT 1 FROM public.personnel pe WHERE pe.id = staff_evaluations.personnel_id AND (pe.school_id IS NULL OR pe.school_id = public.get_user_school_id(auth.uid()))) OR personnel_id IS NULL);