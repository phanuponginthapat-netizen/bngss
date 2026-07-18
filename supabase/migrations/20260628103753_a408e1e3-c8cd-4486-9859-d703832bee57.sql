DROP POLICY IF EXISTS alumni_uni_read_all ON public.alumni_university;
CREATE POLICY alumni_uni_read_scoped ON public.alumni_university
FOR SELECT TO authenticated
USING (
  alumni_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
  OR public.has_role(auth.uid(), 'teacher'::app_role)
);