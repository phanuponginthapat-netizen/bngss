
-- 1) ai_provider_keys: revoke column-level SELECT on api_key from client roles
REVOKE SELECT (api_key) ON public.ai_provider_keys FROM anon, authenticated;

-- 2) app_secrets: admin-only access
DROP POLICY IF EXISTS "admins manage app secrets" ON public.app_secrets;
DROP POLICY IF EXISTS "admins manage app secrets" ON public.app_secrets;
CREATE POLICY "admins manage app secrets" ON public.app_secrets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3) district_snapshots: relax restrictive policy so admins can also read NULL-school rows
DROP POLICY IF EXISTS school_scope_restrictive ON public.district_snapshots;
CREATE POLICY school_scope_restrictive ON public.district_snapshots
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (
    (school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid()))
    OR (school_id IS NULL AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')))
  )
  WITH CHECK (
    (school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid()))
    OR (school_id IS NULL AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')))
  );

-- 4) homework_submissions: restrict viewing to assignment creator + admin/director
DROP POLICY IF EXISTS "assignment owner can view submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "assignment owner can view submissions" ON public.homework_submissions;
CREATE POLICY "assignment owner can view submissions" ON public.homework_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework_assignments a
      WHERE a.id = homework_submissions.assignment_id
        AND (
          a.created_by = auth.uid()
          OR has_role(auth.uid(),'admin'::app_role)
          OR has_role(auth.uid(),'director'::app_role)
        )
    )
  );
