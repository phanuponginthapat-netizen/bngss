CREATE POLICY "Admin/Director can view admissions" ON public.admissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Admin/Director can view budget transactions" ON public.budget_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));