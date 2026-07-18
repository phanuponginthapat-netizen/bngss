
CREATE OR REPLACE FUNCTION public.prevent_self_student_code_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.student_code IS DISTINCT FROM OLD.student_code
     AND COALESCE(OLD.student_code, '') <> ''
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.has_role(auth.uid(), 'director'::app_role) THEN
    RAISE EXCEPTION 'student_code can only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$$;
