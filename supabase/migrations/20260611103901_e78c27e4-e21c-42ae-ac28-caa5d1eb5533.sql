-- Drop the recursive policy
DROP POLICY IF EXISTS "Users update own profile (no escalate must_change_password)" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile (preserve must_change_password)" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Simple, non-recursive UPDATE policy
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Trigger to prevent self-escalation of must_change_password (false -> true)
CREATE OR REPLACE FUNCTION public.guard_must_change_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role and admins/directors to change freely
  IF auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'director'::app_role) THEN
    RETURN NEW;
  END IF;

  -- For self-updates: cannot raise must_change_password from false to true
  IF NEW.id = auth.uid()
     AND COALESCE(OLD.must_change_password, false) = false
     AND COALESCE(NEW.must_change_password, false) = true THEN
    NEW.must_change_password := OLD.must_change_password;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_must_change_password ON public.profiles;
CREATE TRIGGER trg_guard_must_change_password
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_must_change_password();