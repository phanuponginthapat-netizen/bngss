DROP POLICY IF EXISTS "Admins directors manage time_clock" ON public.time_clock;
CREATE POLICY "Admins directors manage time_clock" ON public.time_clock
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

DROP POLICY IF EXISTS "Personnel read own time_clock" ON public.time_clock;
CREATE POLICY "Personnel read own time_clock" ON public.time_clock
FOR SELECT TO authenticated
USING (personnel_id IN (SELECT p.id FROM public.personnel p WHERE p.user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_clock TO authenticated;
GRANT ALL ON public.time_clock TO service_role;