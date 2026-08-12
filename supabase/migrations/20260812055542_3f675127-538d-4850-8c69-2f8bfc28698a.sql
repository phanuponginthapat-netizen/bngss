DROP POLICY IF EXISTS "vault_items_read_all_authenticated" ON public.line_vault_items;
CREATE POLICY "vault_items_read_all_authenticated" ON public.line_vault_items
  FOR SELECT TO authenticated
  USING (true);