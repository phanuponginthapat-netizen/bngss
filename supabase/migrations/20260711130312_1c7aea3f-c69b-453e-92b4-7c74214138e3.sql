
DROP POLICY IF EXISTS ap_read_authenticated ON public.activity_participants;
CREATE POLICY ap_read_scoped ON public.activity_participants
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR has_role(auth.uid(), 'observer'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = activity_participants.student_id
      AND s.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = activity_participants.student_id
      AND p.student_code IS NOT NULL
      AND p.student_code = s.student_code
  )
);

DROP POLICY IF EXISTS as_read_authenticated ON public.activity_scores;
CREATE POLICY as_read_scoped ON public.activity_scores
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR has_role(auth.uid(), 'observer'::app_role)
  OR judge_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.activity_participants ap
    JOIN public.students s ON s.id = ap.student_id
    WHERE ap.id = activity_scores.participant_id
      AND s.auth_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.activity_participants ap
    JOIN public.students s ON s.id = ap.student_id
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE ap.id = activity_scores.participant_id
      AND p.student_code IS NOT NULL
      AND p.student_code = s.student_code
  )
);

DROP POLICY IF EXISTS mem_select ON public.club_members;
CREATE POLICY mem_select_scoped ON public.club_members
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR is_club_advisor(club_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = club_members.student_id
      AND s.auth_user_id = auth.uid()
  )
);
