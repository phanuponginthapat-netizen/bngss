
-- student_face_descriptors: staff manage
CREATE POLICY "staff manage face descriptors"
ON public.student_face_descriptors FOR ALL TO authenticated
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

-- face_registration_requests: staff manage
CREATE POLICY "staff manage face registration requests"
ON public.face_registration_requests FOR ALL TO authenticated
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

-- Students can view their own requests
CREATE POLICY "students view own face requests"
ON public.face_registration_requests FOR SELECT TO authenticated
USING (requested_by = auth.uid());

-- face_registration_history: staff view + insert
CREATE POLICY "staff view face history"
ON public.face_registration_history FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'director'::app_role)
  OR has_role(auth.uid(),'teacher'::app_role)
);

CREATE POLICY "staff insert face history"
ON public.face_registration_history FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'director'::app_role)
  OR has_role(auth.uid(),'teacher'::app_role)
);

-- kiosk_devices: admins/directors full manage; owner select/update own
CREATE POLICY "admins manage kiosk devices"
ON public.kiosk_devices FOR ALL TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'director'::app_role)
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'director'::app_role)
);

CREATE POLICY "owner view own kiosk device"
ON public.kiosk_devices FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "owner update own kiosk device"
ON public.kiosk_devices FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
