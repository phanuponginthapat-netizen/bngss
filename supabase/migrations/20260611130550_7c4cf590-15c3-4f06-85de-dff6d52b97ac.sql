CREATE OR REPLACE FUNCTION public.prevent_sensitive_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.id THEN
    IF NEW.student_code IS DISTINCT FROM OLD.student_code THEN
      RAISE EXCEPTION 'student_code can only be modified by an administrator';
    END IF;
    IF NEW.employee_code IS DISTINCT FROM OLD.employee_code THEN
      RAISE EXCEPTION 'employee_code can only be modified by an administrator';
    END IF;
    IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN
      RAISE EXCEPTION 'school_id can only be modified by an administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;