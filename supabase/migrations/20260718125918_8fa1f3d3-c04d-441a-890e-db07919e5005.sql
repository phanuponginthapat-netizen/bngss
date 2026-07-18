
-- 1) profiles: prevent self-escalation
CREATE OR REPLACE FUNCTION public.prevent_profile_self_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() = NEW.id AND NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    NEW.school_id    := OLD.school_id;
    NEW.is_approved  := OLD.is_approved;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_profile_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_self_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_self_escalation();

-- 2) personnel: prevent self-editing sensitive fields
CREATE OR REPLACE FUNCTION public.prevent_personnel_self_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() = NEW.user_id AND NOT public.has_role(auth.uid(), 'admin') AND NOT public.has_role(auth.uid(), 'super_admin') AND NOT public.has_role(auth.uid(), 'director') THEN
    NEW.position       := OLD.position;
    NEW.position_level := OLD.position_level;
    NEW.department     := OLD.department;
    NEW.employee_code  := OLD.employee_code;
    NEW.status         := OLD.status;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_personnel_self_escalation ON public.personnel;
CREATE TRIGGER trg_prevent_personnel_self_escalation
BEFORE UPDATE ON public.personnel
FOR EACH ROW EXECUTE FUNCTION public.prevent_personnel_self_escalation();

-- 3) lesson_plans: scope peer view to same school
DROP POLICY IF EXISTS lesson_plans_peer_view_approved ON public.lesson_plans;
CREATE POLICY lesson_plans_peer_view_approved ON public.lesson_plans
FOR SELECT TO authenticated
USING (
  status = 'approved'
  AND (
    school_id IS NULL
    OR school_id = public.get_user_school_id(auth.uid())
  )
);
