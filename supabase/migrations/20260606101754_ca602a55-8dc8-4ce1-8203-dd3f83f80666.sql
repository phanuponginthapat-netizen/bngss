CREATE OR REPLACE FUNCTION public.student_in_user_school(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = _student_id
      AND s.school_id IS NOT NULL
      AND s.school_id = public.get_user_school_id(auth.uid())
  );
$function$;