
DROP POLICY IF EXISTS "Active signatures readable by authenticated users" ON public.director_signatures;

CREATE POLICY "Active signatures readable by staff"
  ON public.director_signatures
  FOR SELECT
  TO authenticated
  USING (
    (
      is_active = true
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'director'::app_role)
        OR public.has_role(auth.uid(), 'teacher'::app_role)
      )
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  );
