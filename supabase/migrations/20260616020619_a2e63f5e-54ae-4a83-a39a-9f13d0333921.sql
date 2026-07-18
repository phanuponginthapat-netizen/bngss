
-- Replace the broad teacher SELECT policy with admin/director/self only
DROP POLICY IF EXISTS "Staff can view personnel" ON public.personnel;

CREATE POLICY "Admin/Director/self view personnel"
ON public.personnel
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR user_id = auth.uid()
);
