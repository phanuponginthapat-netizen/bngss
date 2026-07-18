
-- 1) Profiles: prevent self-escalation via UPDATE (school_id, department, is_approved, employee_code, student_code, account_linked, role-ish fields)
CREATE OR REPLACE FUNCTION public.prevent_profile_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_privileged boolean;
BEGIN
  is_privileged := public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director');
  IF NOT is_privileged THEN
    -- Revert sensitive columns to their previous values for non-admin/director callers
    NEW.school_id := OLD.school_id;
    NEW.department := OLD.department;
    NEW.is_approved := OLD.is_approved;
    NEW.employee_code := OLD.employee_code;
    NEW.student_code := OLD.student_code;
    NEW.account_linked := OLD.account_linked;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_self_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_self_escalation();

-- 2) Storage: restrict game-covers INSERT to staff roles
DROP POLICY IF EXISTS "game_covers_auth_write" ON storage.objects;
CREATE POLICY "game_covers_staff_write" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'game-covers'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.has_role(auth.uid(), 'teacher')
  )
);
