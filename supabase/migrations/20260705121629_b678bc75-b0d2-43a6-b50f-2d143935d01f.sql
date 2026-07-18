-- helper: ครูคนนี้สอนวิชานี้หรือไม่ (จาก teacher_assignments หรือ schedules.teacher_name)
CREATE OR REPLACE FUNCTION public.teacher_teaches_subject(_user_id uuid, _subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _subject_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.teacher_assignments ta
      JOIN public.personnel p ON p.id = ta.personnel_id
      WHERE p.user_id = _user_id
        AND ta.subject_id = _subject_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.schedules s
      JOIN public.personnel p ON p.user_id = _user_id
      WHERE s.subject_id = _subject_id
        AND s.teacher_name = COALESCE(p.prefix, '') || p.first_name || ' ' || p.last_name
    );
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_teaches_subject(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.teacher_teaches_subject(uuid, uuid) TO authenticated;

-- INSERT: ครูต้องสอนวิชานั้น (หรือ subject_id เป็น NULL = เช็คโฮมรูม)
DROP POLICY IF EXISTS "Staff can insert attendance" ON public.attendance;
CREATE POLICY "Staff can insert attendance"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'director'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND public.teacher_teaches_subject(auth.uid(), subject_id)
  )
);

-- UPDATE
DROP POLICY IF EXISTS "Staff can update attendance" ON public.attendance;
CREATE POLICY "Staff can update attendance"
ON public.attendance FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'director'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND public.teacher_teaches_subject(auth.uid(), subject_id)
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'director'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND public.teacher_teaches_subject(auth.uid(), subject_id)
  )
);

-- DELETE
DROP POLICY IF EXISTS "Staff can delete attendance" ON public.attendance;
CREATE POLICY "Staff can delete attendance"
ON public.attendance FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'director'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'teacher'::public.app_role)
    AND public.teacher_teaches_subject(auth.uid(), subject_id)
  )
);