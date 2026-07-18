-- 1. Column-level REVOKE for secrets so Data API clients can't read them
REVOKE SELECT (api_key) ON public.ai_provider_keys FROM anon, authenticated;
REVOKE SELECT (api_key) ON public.ai_providers FROM anon, authenticated;
REVOKE SELECT (api_token) ON public.iot_devices FROM anon, authenticated;

-- 2. Helper to test if a student belongs to the caller's school
CREATE OR REPLACE FUNCTION public.student_in_user_school(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = _student_id
      AND (
        s.school_id IS NULL
        OR s.school_id = public.get_user_school_id(auth.uid())
      )
  );
$$;

-- 3. RESTRICTIVE school-scope policy for teachers on student-linked tables.
--    Admin/director bypass; teachers only see/modify rows for students in their school.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'attendance',
    'behavior_records',
    'student_leaves',
    'health_records',
    'vaccine_records',
    'face_scan_logs'
  ]
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS "school_scope_teacher" ON public.%I', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    EXECUTE format($f$
      CREATE POLICY "school_scope_teacher" ON public.%I
        AS RESTRICTIVE
        FOR ALL
        TO authenticated
        USING (
          public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'director')
          OR NOT public.has_role(auth.uid(),'teacher')
          OR public.student_in_user_school(student_id)
        )
        WITH CHECK (
          public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'director')
          OR NOT public.has_role(auth.uid(),'teacher')
          OR public.student_in_user_school(student_id)
        );
    $f$, t);
  END LOOP;
END $$;