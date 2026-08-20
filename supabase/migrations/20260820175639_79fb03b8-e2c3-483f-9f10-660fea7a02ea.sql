DROP POLICY IF EXISTS "Staff full access" ON public.personnel;
DROP POLICY IF EXISTS "Staff read personnel" ON public.personnel;
CREATE POLICY "Staff read personnel" ON public.personnel
FOR SELECT TO authenticated
USING (public.is_staff_any(auth.uid()));

DROP POLICY IF EXISTS "Admins manage personnel" ON public.personnel;
CREATE POLICY "Admins manage personnel" ON public.personnel
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

DROP POLICY IF EXISTS "Personnel update own record" ON public.personnel;
CREATE POLICY "Personnel update own record" ON public.personnel
FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());