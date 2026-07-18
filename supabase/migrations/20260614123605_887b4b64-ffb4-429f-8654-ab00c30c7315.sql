CREATE OR REPLACE FUNCTION public.list_school_members()
 RETURNS TABLE(id uuid, first_name text, last_name text, avatar_url text, position_title text, department text, email text, employee_code text, student_code text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT school_id FROM public.profiles WHERE id = auth.uid()
  )
  SELECT p.id, p.first_name, p.last_name, p.avatar_url, p.position_title, p.department,
         p.google_email, p.employee_code, p.student_code
  FROM public.profiles p
  WHERE p.is_approved = true
    AND (
      (SELECT school_id FROM me) IS NULL
      OR p.school_id IS NULL
      OR p.school_id = (SELECT school_id FROM me)
    )
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST;
$function$;