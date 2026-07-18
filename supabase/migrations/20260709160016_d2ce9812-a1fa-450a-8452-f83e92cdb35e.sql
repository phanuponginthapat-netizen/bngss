
-- Guard trigger: profiles self-update cannot escalate school_id/is_approved/account_linked
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'director'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.school_id      := OLD.school_id;
  NEW.is_approved    := OLD.is_approved;
  NEW.account_linked := OLD.account_linked;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Guard trigger: personnel self-update cannot change school_id/department/position
CREATE OR REPLACE FUNCTION public.prevent_personnel_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'director'::app_role) THEN
    RETURN NEW;
  END IF;
  NEW.school_id  := OLD.school_id;
  NEW.department := OLD.department;
  NEW.position   := OLD.position;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_personnel_self_escalation ON public.personnel;
CREATE TRIGGER trg_prevent_personnel_self_escalation
BEFORE UPDATE ON public.personnel
FOR EACH ROW EXECUTE FUNCTION public.prevent_personnel_self_escalation();
