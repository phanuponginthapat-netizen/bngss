GRANT DELETE ON public.portfolio_items TO authenticated;
DROP POLICY IF EXISTS "portfolio owner delete" ON public.portfolio_items;
CREATE POLICY "portfolio owner delete" ON public.portfolio_items FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));