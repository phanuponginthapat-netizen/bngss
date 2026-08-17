
CREATE OR REPLACE FUNCTION public.is_homeroom_of_classroom(_user_id uuid, _classroom_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.classrooms c
    JOIN public.personnel p ON p.user_id = _user_id
    WHERE c.id = _classroom_id
      AND (
        c.homeroom_teacher = CONCAT(p.prefix, p.first_name, ' ', p.last_name)
        OR c.homeroom_teacher = CONCAT(p.first_name, ' ', p.last_name)
        OR c.homeroom_teacher_2 = CONCAT(p.prefix, p.first_name, ' ', p.last_name)
        OR c.homeroom_teacher_2 = CONCAT(p.first_name, ' ', p.last_name)
      )
  );
$$;

DROP POLICY IF EXISTS "Homeroom teachers can update their students" ON public.students;
CREATE POLICY "Homeroom teachers can update their students"
ON public.students
FOR UPDATE
USING (public.is_homeroom_of_classroom(auth.uid(), classroom_id))
WITH CHECK (public.is_homeroom_of_classroom(auth.uid(), classroom_id));
