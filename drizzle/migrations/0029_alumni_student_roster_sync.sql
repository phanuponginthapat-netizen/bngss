CREATE OR REPLACE FUNCTION public.sync_alumni_student_roster()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'alumni' THEN
    UPDATE public.students
    SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE status END,
        classroom_id = NULL, inclusion_classroom_id = NULL
    WHERE auth_user_id = NEW.user_id
      AND (status = 'active' OR classroom_id IS NOT NULL OR inclusion_classroom_id IS NOT NULL);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_alumni_student_roster() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_sync_alumni_student_roster AFTER INSERT OR UPDATE OF role, user_id ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.sync_alumni_student_roster();
CREATE OR REPLACE FUNCTION public.guard_alumni_student_roster()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.auth_user_id AND role = 'alumni') THEN
    IF NEW.status = 'active' THEN NEW.status := 'inactive'; END IF;
    NEW.classroom_id := NULL;
    NEW.inclusion_classroom_id := NULL;
  ELSIF NEW.status IN ('inactive', 'graduated', 'transferred') THEN
    NEW.classroom_id := NULL;
    NEW.inclusion_classroom_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_alumni_student_roster() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_alumni_student_roster BEFORE INSERT OR UPDATE OF status, auth_user_id, classroom_id, inclusion_classroom_id ON public.students FOR EACH ROW EXECUTE FUNCTION public.guard_alumni_student_roster();