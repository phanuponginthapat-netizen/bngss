-- Fix auto_link_student_on_profile: students table has no `email` column
DROP FUNCTION IF EXISTS public.auto_link_student_on_profile() CASCADE;
CREATE OR REPLACE FUNCTION public.auto_link_student_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p_student_code TEXT;
BEGIN
  p_student_code := NEW.student_code;

  IF p_student_code IS NOT NULL AND p_student_code <> '' THEN
    UPDATE public.students
    SET auth_user_id = NEW.id
    WHERE student_code = p_student_code AND auth_user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;
