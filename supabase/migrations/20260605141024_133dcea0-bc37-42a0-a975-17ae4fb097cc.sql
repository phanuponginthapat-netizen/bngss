
-- 1) ai_providers: hide api_key column from client SELECT (RLS still applies; admin/director can still write)
REVOKE SELECT ON public.ai_providers FROM authenticated;
GRANT SELECT (id, name, provider_type, base_url, model, priority, enabled, supports_vision, supports_json, monthly_call_limit, extra_headers, notes, created_at, updated_at)
  ON public.ai_providers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ai_providers TO authenticated;

-- 2) iot_devices: hide api_token column from client SELECT
REVOKE SELECT ON public.iot_devices FROM authenticated;
GRANT SELECT (id, name, description, device_type, icon, unit, source_type, base_url, entity_id, request_path, json_path, poll_interval_seconds, location, dashboard_group, display_order, is_active, last_value, last_value_numeric, last_status, last_error, last_fetched_at, meta, created_by, created_at, updated_at, system_category, color)
  ON public.iot_devices TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.iot_devices TO authenticated;

-- 3) students: remove NULL-school bypass so teachers without school_id cannot see all students
DROP POLICY IF EXISTS "Staff can view students in their school" ON public.students;
CREATE POLICY "Staff can view students in their school"
ON public.students FOR SELECT
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'director')
  OR (
    public.has_role(auth.uid(),'teacher')
    AND school_id IS NOT NULL
    AND school_id = public.get_user_school_id(auth.uid())
  )
);

-- 4) student_face_descriptors: allow teachers to read (needed for face-scan check-in)
DROP POLICY IF EXISTS "Teachers can view face descriptors" ON public.student_face_descriptors;
CREATE POLICY "Teachers can view face descriptors"
ON public.student_face_descriptors FOR SELECT
USING (public.has_role(auth.uid(),'teacher'));

-- 5) Storage: pp5-files — restrict SELECT to staff only
DROP POLICY IF EXISTS "Authenticated can view pp5 files" ON storage.objects;
CREATE POLICY "Staff can view pp5 files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pp5-files'
  AND (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'director')
    OR public.has_role(auth.uid(),'teacher')
  )
);

-- 6) Storage: ict-loan-photos — restrict SELECT to staff only
DROP POLICY IF EXISTS "Authenticated can view ict loan photos" ON storage.objects;
CREATE POLICY "Staff can view ict loan photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ict-loan-photos'
  AND (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'director')
    OR public.has_role(auth.uid(),'teacher')
  )
);
