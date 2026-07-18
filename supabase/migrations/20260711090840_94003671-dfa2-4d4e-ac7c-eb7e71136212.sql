
-- ============================================================================
-- Fix 3 privilege-escalation findings via BEFORE triggers that preserve
-- staff-only columns when a non-staff (student) user mutates the row.
-- ============================================================================

-- Helper: true if the current auth user is staff (admin/director/teacher).
CREATE OR REPLACE FUNCTION public.is_staff_user(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'director'::app_role)
    OR public.has_role(_uid, 'teacher'::app_role);
$$;

-- ---------------------------------------------------------------------------
-- 1. task_assignments: prevent students from modifying grade/feedback/status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_task_assignment_grading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Staff (or the task creator) may change anything.
  IF public.is_staff_user(auth.uid()) OR NEW.assigned_by = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- Non-staff (students): preserve staff-controlled columns.
  NEW.grade              := OLD.grade;
  NEW.feedback           := OLD.feedback;
  NEW.annotated_file_url := OLD.annotated_file_url;

  -- Students may set status only to submission-related values.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('submitted', 'in_progress', 'pending') THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_task_assignment_grading ON public.task_assignments;
CREATE TRIGGER trg_protect_task_assignment_grading
  BEFORE UPDATE ON public.task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_task_assignment_grading();

-- ---------------------------------------------------------------------------
-- 2. worksheet_submissions: prevent students from setting score/total
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_worksheet_submission_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_staff_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-staff (students): force zero on insert; preserve on update.
  IF TG_OP = 'INSERT' THEN
    NEW.score := 0;
    NEW.total := COALESCE(NEW.total, 0);
    -- Only allow total to reflect worksheet definition; recompute from worksheet.
    SELECT COALESCE(SUM((q->>'points')::numeric), 0)
      INTO NEW.total
      FROM public.worksheets w,
           LATERAL jsonb_array_elements(COALESCE(w.questions, '[]'::jsonb)) q
     WHERE w.id = NEW.worksheet_id;
    NEW.total := COALESCE(NEW.total, 0);
  ELSE
    NEW.score := OLD.score;
    NEW.total := OLD.total;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_worksheet_submission_score ON public.worksheet_submissions;
CREATE TRIGGER trg_protect_worksheet_submission_score
  BEFORE INSERT OR UPDATE ON public.worksheet_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_worksheet_submission_score();

-- ---------------------------------------------------------------------------
-- 3. incomplete_grade_fix_requests: split students ALL policy + trigger
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students manage their own fix requests"
  ON public.incomplete_grade_fix_requests;

-- Students may create their own request (status defaults to 'pending').
CREATE POLICY "Students create their own fix requests"
  ON public.incomplete_grade_fix_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.auth_user_id = auth.uid()
         OR s.student_code = (SELECT p.student_code FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- Students may view their own requests.
CREATE POLICY "Students view their own fix requests"
  ON public.incomplete_grade_fix_requests
  FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.auth_user_id = auth.uid()
         OR s.student_code = (SELECT p.student_code FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- Students may update ONLY the student_note field on their own requests
-- (trigger below enforces which columns can actually change).
CREATE POLICY "Students update note on their own fix requests"
  ON public.incomplete_grade_fix_requests
  FOR UPDATE
  TO authenticated
  USING (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.auth_user_id = auth.uid()
         OR s.student_code = (SELECT p.student_code FROM public.profiles p WHERE p.id = auth.uid())
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.auth_user_id = auth.uid()
         OR s.student_code = (SELECT p.student_code FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- Trigger: on UPDATE by non-staff, force workflow columns back to OLD values.
CREATE OR REPLACE FUNCTION public.protect_incomplete_grade_fix_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Staff (teacher/director/admin) bypass.
  IF public.is_staff_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Students: preserve every teacher-controlled column.
  NEW.status        := OLD.status;
  NEW.assigned_task := OLD.assigned_task;
  NEW.exam_date     := OLD.exam_date;
  NEW.exam_location := OLD.exam_location;
  NEW.teacher_note  := OLD.teacher_note;
  NEW.teacher_id    := OLD.teacher_id;
  NEW.responded_by  := OLD.responded_by;
  NEW.responded_at  := OLD.responded_at;
  NEW.completed_at  := OLD.completed_at;
  NEW.grade_type    := OLD.grade_type;
  NEW.subject_id    := OLD.subject_id;
  NEW.academic_year := OLD.academic_year;
  NEW.semester      := OLD.semester;
  NEW.student_id    := OLD.student_id;
  NEW.report_id     := OLD.report_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_incomplete_grade_fix_workflow
  ON public.incomplete_grade_fix_requests;
CREATE TRIGGER trg_protect_incomplete_grade_fix_workflow
  BEFORE UPDATE ON public.incomplete_grade_fix_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_incomplete_grade_fix_workflow();
