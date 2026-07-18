CREATE OR REPLACE FUNCTION public.is_homeroom_of_classroom(_user_id uuid, _classroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.classrooms c
    JOIN public.personnel p ON p.user_id = _user_id
    WHERE c.id = _classroom_id
      AND (
        c.homeroom_teacher_id = p.id
        OR c.homeroom_teacher_2_id = p.id
      )
  );
$function$;