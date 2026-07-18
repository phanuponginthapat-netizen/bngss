
REVOKE SELECT (api_token) ON public.iot_devices FROM authenticated;
REVOKE SELECT (api_token) ON public.iot_devices FROM anon;

DROP POLICY IF EXISTS "Auth users view proc docs" ON public.procurement_documents;
CREATE POLICY "Admin/Director view proc docs"
  ON public.procurement_documents FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

DROP POLICY IF EXISTS "Anyone authenticated can view school_settings" ON public.school_settings;
CREATE POLICY "Authenticated view non-sensitive school_settings"
  ON public.school_settings FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR (
      setting_key NOT ILIKE '%secret%'
      AND setting_key NOT ILIKE '%token%'
      AND setting_key NOT ILIKE '%api_key%'
      AND setting_key NOT ILIKE '%password%'
      AND setting_key NOT ILIKE '%private%'
      AND setting_key NOT ILIKE '%credential%'
      AND setting_key NOT ILIKE '%webhook%'
    )
  );

CREATE OR REPLACE FUNCTION public.is_teacher_assigned_to_classroom(_user_id uuid, _classroom_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    JOIN public.personnel p ON p.id = ta.personnel_id
    WHERE p.user_id = _user_id
      AND ta.classroom_id = _classroom_id
  )
$$;

DROP POLICY IF EXISTS "Staff can view students in their school" ON public.students;
DROP POLICY IF EXISTS "Staff view students in their school" ON public.students;

CREATE POLICY "Student visibility scoped"
  ON public.students FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR (auth_user_id = auth.uid())
    OR is_homeroom_of_classroom(auth.uid(), classroom_id)
    OR is_teacher_assigned_to_classroom(auth.uid(), classroom_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.line_user_id IS NOT NULL
        AND (p.line_user_id = students.line_user_id
          OR p.line_user_id = students.line_user_id_2
          OR p.line_user_id = students.line_user_id_3)
    )
  );
