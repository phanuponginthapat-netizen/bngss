
DROP POLICY IF EXISTS "Auth users can view action_plans" ON public.action_plans;
CREATE POLICY "Staff can view action_plans"
ON public.action_plans FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

DROP POLICY IF EXISTS "Authenticated can view assets" ON public.assets;
CREATE POLICY "Staff can view assets"
ON public.assets FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

DROP POLICY IF EXISTS "Devices viewable by authenticated" ON public.ict_devices;
CREATE POLICY "Staff or borrower can view ict_devices"
ON public.ict_devices FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.ict_loans l
    WHERE l.device_id = ict_devices.id
      AND l.borrowed_by = auth.uid()
      AND l.returned_at IS NULL
  )
);

DROP POLICY IF EXISTS "Anyone authenticated can view school_settings" ON public.school_settings;
CREATE POLICY "Admin/director can view school_settings"
ON public.school_settings FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);

CREATE OR REPLACE FUNCTION public.is_homeroom_of_student(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.classrooms c ON c.id = s.classroom_id
    JOIN public.personnel p ON p.id IN (c.homeroom_teacher_id, c.homeroom_teacher_2_id)
    WHERE s.id = _student_id
      AND p.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_teaches_subject(_user_id uuid, _subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _subject_id IS NOT NULL
    AND (
      EXISTS (
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
      )
    );
$$;

DROP POLICY IF EXISTS "Staff can insert attendance" ON public.attendance;
CREATE POLICY "Staff can insert attendance"
ON public.attendance FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR (
    has_role(auth.uid(), 'teacher'::app_role)
    AND (
      (attendance.subject_id IS NOT NULL AND teacher_teaches_subject(auth.uid(), attendance.subject_id))
      OR (attendance.subject_id IS NULL AND is_homeroom_of_student(auth.uid(), attendance.student_id))
    )
  )
);

DROP POLICY IF EXISTS "Staff can update attendance" ON public.attendance;
CREATE POLICY "Staff can update attendance"
ON public.attendance FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR (
    has_role(auth.uid(), 'teacher'::app_role)
    AND (
      (attendance.subject_id IS NOT NULL AND teacher_teaches_subject(auth.uid(), attendance.subject_id))
      OR (attendance.subject_id IS NULL AND is_homeroom_of_student(auth.uid(), attendance.student_id))
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR (
    has_role(auth.uid(), 'teacher'::app_role)
    AND (
      (attendance.subject_id IS NOT NULL AND teacher_teaches_subject(auth.uid(), attendance.subject_id))
      OR (attendance.subject_id IS NULL AND is_homeroom_of_student(auth.uid(), attendance.student_id))
    )
  )
);

DROP POLICY IF EXISTS "Staff can delete attendance" ON public.attendance;
CREATE POLICY "Staff can delete attendance"
ON public.attendance FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR (
    has_role(auth.uid(), 'teacher'::app_role)
    AND (
      (attendance.subject_id IS NOT NULL AND teacher_teaches_subject(auth.uid(), attendance.subject_id))
      OR (attendance.subject_id IS NULL AND is_homeroom_of_student(auth.uid(), attendance.student_id))
    )
  )
);
