DROP POLICY IF EXISTS "Users manage own departments" ON public.user_departments;

DROP POLICY IF EXISTS "Users can view own department memberships" ON public.user_departments;
CREATE POLICY "Users can view own department memberships"
ON public.user_departments FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins and directors manage department memberships" ON public.user_departments;
CREATE POLICY "Admins and directors manage department memberships"
ON public.user_departments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));