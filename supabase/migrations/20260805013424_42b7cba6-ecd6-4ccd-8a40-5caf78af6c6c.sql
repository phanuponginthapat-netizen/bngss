DROP POLICY IF EXISTS "school_scope_restrictive" ON public.students;
CREATE POLICY "school_scope_restrictive" ON public.students AS RESTRICTIVE FOR ALL TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
WITH CHECK (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "school_scope_restrictive" ON public.personnel;
CREATE POLICY "school_scope_restrictive" ON public.personnel AS RESTRICTIVE FOR ALL TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
WITH CHECK (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));