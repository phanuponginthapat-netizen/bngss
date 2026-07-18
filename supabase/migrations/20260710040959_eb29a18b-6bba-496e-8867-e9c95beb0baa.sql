
DROP POLICY IF EXISTS "users can upsert own device row" ON public.kiosk_devices;
DROP POLICY IF EXISTS "users can update own device row" ON public.kiosk_devices;

CREATE POLICY "staff or owner can insert device row"
ON public.kiosk_devices
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid())
  OR (
    user_id IS NULL AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'director'::app_role)
      OR public.has_role(auth.uid(), 'teacher'::app_role)
    )
  )
);

CREATE POLICY "staff or owner can update device row"
ON public.kiosk_devices
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
  OR (
    user_id IS NULL AND public.has_role(auth.uid(), 'teacher'::app_role)
  )
)
WITH CHECK (
  (user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
  OR (
    user_id IS NULL AND public.has_role(auth.uid(), 'teacher'::app_role)
  )
);
