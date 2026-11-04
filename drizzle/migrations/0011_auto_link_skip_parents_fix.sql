CREATE OR REPLACE FUNCTION public.auto_link_student_on_profile()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Parent accounts must never become the student's own login.
  IF NEW.student_code IS NOT NULL AND NEW.student_code <> ''
     AND NOT public.has_role(NEW.id, 'parent'::app_role) THEN
    UPDATE public.students SET auth_user_id = NEW.id
    WHERE student_code = NEW.student_code AND auth_user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;