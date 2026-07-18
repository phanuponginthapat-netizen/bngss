CREATE OR REPLACE FUNCTION public.prevent_self_student_code_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service role / edge functions (no auth context)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Allow admins and directors
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'director'::app_role) THEN
    RETURN NEW;
  END IF;
  -- Block only when a non-admin user tries to change their own student_code
  IF NEW.student_code IS DISTINCT FROM OLD.student_code
     AND auth.uid() = OLD.id THEN
    RAISE EXCEPTION 'student_code can only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$$;