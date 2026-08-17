
-- 1. cms_settings: explicit allowlist via is_public flag
ALTER TABLE public.cms_settings
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings;
DROP POLICY IF EXISTS "Anon view explicitly public cms keys" ON public.cms_settings;
CREATE POLICY "Anon view explicitly public cms keys"
ON public.cms_settings FOR SELECT
TO anon
USING (is_public = true);

-- 2. game_hub_scores: reaffirm strict scoped read (drop any legacy USING(true))
DROP POLICY IF EXISTS "scores_read_all_auth" ON public.game_hub_scores;
DROP POLICY IF EXISTS "scores_read_scoped" ON public.game_hub_scores;
CREATE POLICY "scores_read_scoped"
ON public.game_hub_scores FOR SELECT
TO authenticated
USING (
  auth_user_id = auth.uid()
  OR is_parent_of(auth.uid(), student_id)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

-- 3. profiles.student_code: block self-update at column-privilege level too.
-- Revoke UPDATE on student_code from authenticated so parents cannot self-assign
-- another student's code. Admin/director changes go through service_role or an
-- admin-only RPC. Trigger prevent_self_student_code_change remains as defense-in-depth.
REVOKE UPDATE (student_code) ON public.profiles FROM authenticated;
REVOKE UPDATE (student_code) ON public.profiles FROM anon;

-- Ensure the existing trigger still exists and is active
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_prevent_self_student_code_change'
      AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER trg_prevent_self_student_code_change
    BEFORE UPDATE OF student_code ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_self_student_code_change();
  END IF;
END $$;
