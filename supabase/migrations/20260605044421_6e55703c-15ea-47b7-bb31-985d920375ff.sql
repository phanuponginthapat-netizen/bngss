DROP POLICY IF EXISTS "Admin/Director can view admissions" ON public.admissions;
DROP POLICY IF EXISTS "Admin/Director can view admissions" ON public.admissions;
CREATE POLICY "Admin/Director can view admissions" ON public.admissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Admin/Director can view budget transactions" ON public.budget_transactions;
DROP POLICY IF EXISTS "Admin/Director can view budget transactions" ON public.budget_transactions;
CREATE POLICY "Admin/Director can view budget transactions" ON public.budget_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));