
-- 1) Revoke direct SELECT on the api_key column from regular roles
REVOKE SELECT (api_key) ON public.ai_providers FROM authenticated;
REVOKE SELECT (api_key) ON public.ai_providers FROM anon;

-- 2) Prevent users from changing student_code on their own profile (admins can still change it)
CREATE OR REPLACE FUNCTION public.prevent_self_student_code_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.student_code IS DISTINCT FROM OLD.student_code
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.has_role(auth.uid(), 'director'::app_role) THEN
    RAISE EXCEPTION 'student_code can only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_student_code_change ON public.profiles;
CREATE TRIGGER trg_prevent_self_student_code_change
BEFORE UPDATE OF student_code ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_student_code_change();
