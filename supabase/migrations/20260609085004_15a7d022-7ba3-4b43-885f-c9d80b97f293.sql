-- Helper: parent ↔ child via profiles.student_code = students.student_code
CREATE OR REPLACE FUNCTION public.is_parent_of(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.students s ON s.student_code = p.student_code
    WHERE p.id = _user_id
      AND s.id = _student_id
      AND p.student_code IS NOT NULL
      AND p.student_code <> ''
      AND public.has_role(_user_id, 'parent'::app_role)
  );
$$;

-- Parent SELECT policies
CREATE POLICY "Parents view child attendance"
  ON public.attendance FOR SELECT
  USING (public.is_parent_of(auth.uid(), student_id));

CREATE POLICY "Parents view child behavior"
  ON public.behavior_records FOR SELECT
  USING (public.is_parent_of(auth.uid(), student_id));

CREATE POLICY "Parents view child leaves"
  ON public.student_leaves FOR SELECT
  USING (public.is_parent_of(auth.uid(), student_id));

CREATE POLICY "Parents request child leaves"
  ON public.student_leaves FOR INSERT
  WITH CHECK (public.is_parent_of(auth.uid(), student_id));

CREATE POLICY "Parents view child health"
  ON public.health_measurements FOR SELECT
  USING (public.is_parent_of(auth.uid(), student_id));