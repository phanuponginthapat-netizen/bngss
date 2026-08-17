
DROP POLICY IF EXISTS "staff insert face scan logs" ON public.face_scan_logs;
CREATE POLICY "staff insert face scan logs"
ON public.face_scan_logs FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'director'::app_role)
  OR has_role(auth.uid(),'teacher'::app_role)
);

DROP POLICY IF EXISTS "staff view face scan logs" ON public.face_scan_logs;
CREATE POLICY "staff view face scan logs"
ON public.face_scan_logs FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'director'::app_role)
  OR has_role(auth.uid(),'teacher'::app_role)
);

DROP POLICY IF EXISTS "staff update face scan logs" ON public.face_scan_logs;
CREATE POLICY "staff update face scan logs"
ON public.face_scan_logs FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'director'::app_role)
  OR has_role(auth.uid(),'teacher'::app_role)
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'director'::app_role)
  OR has_role(auth.uid(),'teacher'::app_role)
);
