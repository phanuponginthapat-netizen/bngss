
-- 1) Tighten students "Student visibility scoped" - require parent role for LINE-based access
DROP POLICY IF EXISTS "Student visibility scoped" ON public.students;
CREATE POLICY "Student visibility scoped" ON public.students
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR (auth_user_id = auth.uid())
  OR is_homeroom_of_classroom(auth.uid(), classroom_id)
  OR is_teacher_assigned_to_classroom(auth.uid(), classroom_id)
  OR (
    has_role(auth.uid(), 'parent'::app_role)
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.line_user_id IS NOT NULL
        AND (
          p.line_user_id = students.line_user_id
          OR p.line_user_id = students.line_user_id_2
          OR p.line_user_id = students.line_user_id_3
        )
    )
  )
);

-- 2) worksheet_submissions - replace permissive anon insert with authenticated + published worksheet check
DROP POLICY IF EXISTS wss_insert_any ON public.worksheet_submissions;
CREATE POLICY wss_insert_authenticated ON public.worksheet_submissions
FOR INSERT TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.worksheets w
    WHERE w.id = worksheet_submissions.worksheet_id
  )
);
REVOKE INSERT ON public.worksheet_submissions FROM anon;

-- 3) ai_providers / ai_provider_keys - prevent raw api_key column from ever being read by clients.
-- Revoke column-level SELECT on api_key; clients already use *_meta views without the secret.
REVOKE SELECT ON public.ai_providers FROM authenticated, anon;
REVOKE SELECT ON public.ai_provider_keys FROM authenticated, anon;
GRANT SELECT (id, name, provider_type, base_url, model, priority, enabled, supports_vision, supports_json, monthly_call_limit, extra_headers, notes, created_at, updated_at)
  ON public.ai_providers TO authenticated;
GRANT SELECT (id, provider_type, label, status, used_today, used_total, daily_limit, cooldown_until, last_used_at, last_error, last_reset_date, priority, created_at, updated_at)
  ON public.ai_provider_keys TO authenticated;
