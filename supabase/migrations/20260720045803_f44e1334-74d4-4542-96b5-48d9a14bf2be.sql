
DROP POLICY IF EXISTS "Students view own classroom schedules" ON public.schedules;
CREATE POLICY "Students view own classroom schedules"
ON public.schedules FOR SELECT TO authenticated
USING (
  classroom_id IN (
    SELECT classroom_id FROM public.students WHERE auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Parents view children classroom schedules" ON public.schedules;
CREATE POLICY "Parents view children classroom schedules"
ON public.schedules FOR SELECT TO authenticated
USING (
  classroom_id IN (
    SELECT classroom_id FROM public.students
    WHERE parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid()
  )
);
