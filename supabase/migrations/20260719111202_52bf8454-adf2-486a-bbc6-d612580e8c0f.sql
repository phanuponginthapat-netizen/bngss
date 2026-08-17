
-- 1. Prevent students from spoofing student_code on profiles
CREATE OR REPLACE FUNCTION public.prevent_student_code_self_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.student_code IS DISTINCT FROM OLD.student_code THEN
    IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
         OR public.has_role(auth.uid(), 'director'::app_role)) THEN
      RAISE EXCEPTION 'ไม่อนุญาตให้แก้ไขรหัสนักเรียนของโปรไฟล์ตนเอง';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_code_self_edit ON public.profiles;
CREATE TRIGGER trg_prevent_student_code_self_edit
BEFORE UPDATE OF student_code ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_student_code_self_edit();

-- 2. Re-key sensitive policies off students.auth_user_id only (drop profile.student_code fallback)
DROP POLICY IF EXISTS "Students view their own incomplete grade reports" ON public.incomplete_grade_reports;
DROP POLICY IF EXISTS "Students view their own incomplete grade reports" ON public.incomplete_grade_reports;
CREATE POLICY "Students view their own incomplete grade reports"
ON public.incomplete_grade_reports
FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Students create their own fix requests" ON public.incomplete_grade_fix_requests;
DROP POLICY IF EXISTS "Students create their own fix requests" ON public.incomplete_grade_fix_requests;
CREATE POLICY "Students create their own fix requests"
ON public.incomplete_grade_fix_requests
FOR INSERT
TO authenticated
WITH CHECK (
  student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Students update note on their own fix requests" ON public.incomplete_grade_fix_requests;
DROP POLICY IF EXISTS "Students update note on their own fix requests" ON public.incomplete_grade_fix_requests;
CREATE POLICY "Students update note on their own fix requests"
ON public.incomplete_grade_fix_requests
FOR UPDATE
TO authenticated
USING (
  student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid())
)
WITH CHECK (
  student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Students view their own fix requests" ON public.incomplete_grade_fix_requests;
DROP POLICY IF EXISTS "Students view their own fix requests" ON public.incomplete_grade_fix_requests;
CREATE POLICY "Students view their own fix requests"
ON public.incomplete_grade_fix_requests
FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid())
);

DROP POLICY IF EXISTS "ap_read_scoped" ON public.activity_participants;
DROP POLICY IF EXISTS "ap_read_scoped" ON public.activity_participants;
CREATE POLICY "ap_read_scoped"
ON public.activity_participants
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR has_role(auth.uid(), 'observer'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = activity_participants.student_id AND s.auth_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "as_read_scoped" ON public.activity_scores;
DROP POLICY IF EXISTS "as_read_scoped" ON public.activity_scores;
CREATE POLICY "as_read_scoped"
ON public.activity_scores
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR has_role(auth.uid(), 'observer'::app_role)
  OR judge_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.activity_participants ap
    JOIN public.students s ON s.id = ap.student_id
    WHERE ap.id = activity_scores.participant_id AND s.auth_user_id = auth.uid()
  )
);

-- 3. Fix chat_reports admin update tautology
DROP POLICY IF EXISTS "admin updates reports" ON public.chat_reports;
DROP POLICY IF EXISTS "admin updates reports" ON public.chat_reports;
CREATE POLICY "admin updates reports"
ON public.chat_reports
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Re-scope public-role policies to authenticated
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "own sleep logs" ON public.fitness_sleep_logs;
DROP POLICY IF EXISTS "own sleep logs" ON public.fitness_sleep_logs;
CREATE POLICY "own sleep logs"
ON public.fitness_sleep_logs
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Sender can manage recipients" ON public.eform_recipients;
DROP POLICY IF EXISTS "Sender can manage recipients" ON public.eform_recipients;
CREATE POLICY "Sender can manage recipients"
ON public.eform_recipients
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.eforms e WHERE e.id = eform_recipients.eform_id AND e.sender_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.eforms e WHERE e.id = eform_recipients.eform_id AND e.sender_id = auth.uid())
);

DROP POLICY IF EXISTS "admin/director can manage matrix" ON public.role_notification_defaults;
DROP POLICY IF EXISTS "admin/director can manage matrix" ON public.role_notification_defaults;
CREATE POLICY "admin/director can manage matrix"
ON public.role_notification_defaults
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

DROP POLICY IF EXISTS "anyone can read matrix" ON public.role_notification_defaults;
DROP POLICY IF EXISTS "anyone can read matrix" ON public.role_notification_defaults;
CREATE POLICY "anyone can read matrix"
ON public.role_notification_defaults
FOR SELECT
TO authenticated
USING (true);
