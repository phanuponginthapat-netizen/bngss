
-- 1) iot_devices: only admin/director may read (api_token secret)
DROP POLICY IF EXISTS "iot read auth" ON public.iot_devices;
DROP POLICY IF EXISTS "iot_devices admin read" ON public.iot_devices;
CREATE POLICY "iot_devices admin read"
ON public.iot_devices FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- 2) personnel_face_descriptors: restrictive school scoping
DROP POLICY IF EXISTS "personnel face descriptors school scope" ON public.personnel_face_descriptors;
CREATE POLICY "personnel face descriptors school scope"
ON public.personnel_face_descriptors AS RESTRICTIVE FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.personnel p
    WHERE p.id = personnel_face_descriptors.personnel_id
      AND (p.school_id IS NULL OR p.school_id = public.get_user_school_id(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.personnel p
    WHERE p.id = personnel_face_descriptors.personnel_id
      AND (p.school_id IS NULL OR p.school_id = public.get_user_school_id(auth.uid()))
  )
);

-- 3) student_face_descriptors: restrictive school scoping
DROP POLICY IF EXISTS "student face descriptors school scope" ON public.student_face_descriptors;
CREATE POLICY "student face descriptors school scope"
ON public.student_face_descriptors AS RESTRICTIVE FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_face_descriptors.student_id
      AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_face_descriptors.student_id
      AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid()))
  )
);
