
-- 1) profiles: scope observer SELECT to same school
DROP POLICY IF EXISTS "Observers can view" ON public.profiles;
CREATE POLICY "Observers can view profiles in own school"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'observer'::app_role)
  AND (
    school_id IS NULL
    OR get_user_school_id(auth.uid()) IS NULL
    OR school_id = get_user_school_id(auth.uid())
  )
);

-- 2) students: remove LINE-ID match branch from parent access path
DROP POLICY IF EXISTS "Student visibility scoped" ON public.students;
CREATE POLICY "Student visibility scoped"
ON public.students
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR (auth_user_id = auth.uid())
  OR is_homeroom_of_classroom(auth.uid(), classroom_id)
  OR is_teacher_assigned_to_classroom(auth.uid(), classroom_id)
  OR (
    has_role(auth.uid(), 'parent'::app_role)
    AND (
      parent_user_id = auth.uid()
      OR parent_user_id_2 = auth.uid()
    )
  )
);

-- 3) Remove sensitive tables from Realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.pdpa_requests;
ALTER PUBLICATION supabase_realtime DROP TABLE public.tuition_invoices;
