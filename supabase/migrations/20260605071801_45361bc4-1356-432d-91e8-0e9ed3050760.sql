
-- Fix 1: home_visits homeroom policy — use UUID matching instead of fragile name string matching
DROP POLICY IF EXISTS "Homeroom teacher manage home_visits (secure)" ON public.home_visits;

CREATE POLICY "Homeroom teacher manage home_visits (secure)"
ON public.home_visits
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = home_visits.student_id
      AND public.is_homeroom_of_classroom(auth.uid(), s.classroom_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.students s
    WHERE s.id = home_visits.student_id
      AND public.is_homeroom_of_classroom(auth.uid(), s.classroom_id)
  )
);

-- Fix 2: students teacher SELECT — scope to same school as the teacher
DROP POLICY IF EXISTS "Staff can view all students" ON public.students;

CREATE POLICY "Staff can view students in their school"
ON public.students
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR (
    has_role(auth.uid(), 'teacher'::app_role)
    AND (
      school_id IS NULL
      OR school_id = public.get_user_school_id(auth.uid())
      OR public.get_user_school_id(auth.uid()) IS NULL
    )
  )
);
