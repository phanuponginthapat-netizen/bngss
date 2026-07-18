DROP POLICY IF EXISTS "teachers can create boards" ON public.padlet_boards;

CREATE POLICY "staff can create boards"
ON public.padlet_boards FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = owner_id
  AND NOT public.has_role(auth.uid(), 'student')
  AND NOT public.has_role(auth.uid(), 'parent')
  AND NOT public.has_role(auth.uid(), 'alumni')
);