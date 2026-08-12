-- Helper: children ids of a parent (security definer, avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.parent_child_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(s.id), '{}')
  FROM public.students s
  WHERE (s.parent_user_id = _user_id OR s.parent_user_id_2 = _user_id)
    AND public.has_role(_user_id, 'parent'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.parent_child_codes(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(s.student_code), '{}')
  FROM public.students s
  WHERE (s.parent_user_id = _user_id OR s.parent_user_id_2 = _user_id)
    AND public.has_role(_user_id, 'parent'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.parent_child_classroom_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT s.classroom_id) FILTER (WHERE s.classroom_id IS NOT NULL), '{}')
  FROM public.students s
  WHERE (s.parent_user_id = _user_id OR s.parent_user_id_2 = _user_id)
    AND public.has_role(_user_id, 'parent'::app_role);
$$;

-- students: parents can read only their own children
DROP POLICY IF EXISTS "Parents view their children" ON public.students;
CREATE POLICY "Parents view their children"
ON public.students FOR SELECT TO authenticated
USING (
  (parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid())
  AND public.has_role(auth.uid(), 'parent'::app_role)
);

-- health records
DROP POLICY IF EXISTS "Parents view child health records" ON public.health_records;
CREATE POLICY "Parents view child health records"
ON public.health_records FOR SELECT TO authenticated
USING (student_id = ANY (public.parent_child_ids(auth.uid())));

-- SDQ
DROP POLICY IF EXISTS "Parents view child sdq" ON public.sdq_records;
CREATE POLICY "Parents view child sdq"
ON public.sdq_records FOR SELECT TO authenticated
USING (student_id = ANY (public.parent_child_ids(auth.uid())));

-- enrollments
DROP POLICY IF EXISTS "Parents view child enrollments" ON public.enrollments;
CREATE POLICY "Parents view child enrollments"
ON public.enrollments FOR SELECT TO authenticated
USING (student_id = ANY (public.parent_child_ids(auth.uid())));

-- scores
DROP POLICY IF EXISTS "Parents view child scores" ON public.student_scores;
CREATE POLICY "Parents view child scores"
ON public.student_scores FOR SELECT TO authenticated
USING (student_code = ANY (public.parent_child_codes(auth.uid())));

-- homework / task assignments (personal + class-wide)
DROP POLICY IF EXISTS "Parents view child homework" ON public.task_assignments;
CREATE POLICY "Parents view child homework"
ON public.task_assignments FOR SELECT TO authenticated
USING (
  assigned_to_student_id = ANY (public.parent_child_ids(auth.uid()))
  OR (
    assigned_to_student_id IS NULL
    AND classroom_id = ANY (public.parent_child_classroom_ids(auth.uid()))
  )
);