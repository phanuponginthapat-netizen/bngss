
DROP POLICY IF EXISTS "Teachers and directors insert attendance" ON public.attendance;
CREATE POLICY "Teachers and directors insert attendance"
ON public.attendance FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Teachers and directors update attendance" ON public.attendance;
CREATE POLICY "Teachers and directors update attendance"
ON public.attendance FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);
