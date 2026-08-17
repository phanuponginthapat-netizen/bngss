-- Drop existing permissive policies
DROP POLICY IF EXISTS "Auth users can manage student_screenings" ON public.student_screenings;
DROP POLICY IF EXISTS "Auth users can view student_screenings" ON public.student_screenings;
DROP POLICY IF EXISTS "Authenticated users can manage student_screenings" ON public.student_screenings;
DROP POLICY IF EXISTS "Authenticated users can view student_screenings" ON public.student_screenings;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.student_screenings;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.student_screenings;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.student_screenings;
DROP POLICY IF EXISTS "Staff manage own school screenings" ON public.student_screenings;
DROP POLICY IF EXISTS "Super/Area admin view all screenings" ON public.student_screenings;
DROP POLICY IF EXISTS "Students view their own screenings" ON public.student_screenings;
DROP POLICY IF EXISTS "Parents view linked student screenings" ON public.student_screenings;

ALTER TABLE public.student_screenings ENABLE ROW LEVEL SECURITY;

-- Staff manage screenings for students in their school
DROP POLICY IF EXISTS "Staff manage own school screenings" ON public.student_screenings;
CREATE POLICY "Staff manage own school screenings"
ON public.student_screenings
FOR ALL
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
    OR has_role(auth.uid(), 'school_admin'::app_role))
  AND (
    student_id IS NULL
    OR student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.school_id IS NULL OR s.school_id = get_user_school_id(auth.uid())
    )
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
    OR has_role(auth.uid(), 'school_admin'::app_role))
  AND (
    student_id IS NULL
    OR student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.school_id IS NULL OR s.school_id = get_user_school_id(auth.uid())
    )
  )
);

-- Super/Area admin view all
DROP POLICY IF EXISTS "Super/Area admin view all screenings" ON public.student_screenings;
CREATE POLICY "Super/Area admin view all screenings"
ON public.student_screenings
FOR SELECT
TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

-- Students view their own screenings
DROP POLICY IF EXISTS "Students view their own screenings" ON public.student_screenings;
CREATE POLICY "Students view their own screenings"
ON public.student_screenings
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid()
  )
);

-- Parents view linked student screenings
DROP POLICY IF EXISTS "Parents view linked student screenings" ON public.student_screenings;
CREATE POLICY "Parents view linked student screenings"
ON public.student_screenings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'parent'::app_role)
  AND student_id IN (
    SELECT psl.student_id FROM public.parent_student_links psl
    WHERE psl.parent_user_id = auth.uid()
  )
);
