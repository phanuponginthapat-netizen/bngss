
-- 1) iot_devices: drop teacher SELECT access (api_token sensitive)
DROP POLICY IF EXISTS "Staff can view iot devices" ON public.iot_devices;

-- 2) profiles: drop permissive UPDATE that bypasses must_change_password protection
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 3) student_face_descriptors: add restrictive school-scope policy for teachers
CREATE POLICY "school_scope_teacher_face_desc"
ON public.student_face_descriptors
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR NOT has_role(auth.uid(), 'teacher'::app_role)
  OR student_in_user_school(student_id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR NOT has_role(auth.uid(), 'teacher'::app_role)
  OR student_in_user_school(student_id)
);
