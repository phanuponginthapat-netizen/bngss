
-- Fix 1: attendance.school_scope_teacher PERMISSIVE bug -> RESTRICTIVE for teachers only
DROP POLICY IF EXISTS school_scope_teacher ON public.attendance;
CREATE POLICY school_scope_teacher ON public.attendance
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  NOT (SELECT has_role(auth.uid(), 'teacher'::app_role))
  OR (SELECT has_role(auth.uid(), 'admin'::app_role))
  OR (SELECT has_role(auth.uid(), 'director'::app_role))
  OR student_in_user_school(student_id)
);

-- Fix 2: fitness_profiles teacher SELECT scoped to their homeroom students
DROP POLICY IF EXISTS "staff view fitness profiles" ON public.fitness_profiles;
CREATE POLICY "staff view fitness profiles" ON public.fitness_profiles
FOR SELECT
TO authenticated
USING (
  (SELECT has_role(auth.uid(), 'admin'::app_role))
  OR (SELECT has_role(auth.uid(), 'director'::app_role))
  OR (
    (SELECT has_role(auth.uid(), 'teacher'::app_role))
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.auth_user_id = fitness_profiles.user_id
        AND public.is_homeroom_teacher_of_student(auth.uid(), s.id)
    )
  )
);
