
-- ============================================================
-- Prevent students from self-grading homework_submissions
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_homework_submission_self_grading()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Staff/admin/director may change any field
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'director'::app_role)
     OR public.has_role(auth.uid(), 'teacher'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Students (and everyone else) cannot alter grading fields
  NEW.score       := OLD.score;
  NEW.auto_score  := OLD.auto_score;
  NEW.final_score := OLD.final_score;
  NEW.feedback    := OLD.feedback;
  NEW.graded_by   := OLD.graded_by;
  NEW.graded_at   := OLD.graded_at;
  NEW.status      := OLD.status;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_homework_submission_self_grading ON public.homework_submissions;
CREATE TRIGGER prevent_homework_submission_self_grading
BEFORE UPDATE ON public.homework_submissions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_homework_submission_self_grading();

-- ============================================================
-- Prevent students from self-grading task_assignments
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_task_assignment_self_grading()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'director'::app_role)
     OR public.has_role(auth.uid(), 'teacher'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.grade    := OLD.grade;
  NEW.feedback := OLD.feedback;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_task_assignment_self_grading ON public.task_assignments;
CREATE TRIGGER prevent_task_assignment_self_grading
BEFORE UPDATE ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_task_assignment_self_grading();

-- ============================================================
-- Extend personnel self-escalation trigger to cover
-- employee_code and status (in addition to school_id/department/position)
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_personnel_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'director'::app_role) THEN
    RETURN NEW;
  END IF;

  NEW.school_id     := OLD.school_id;
  NEW.department    := OLD.department;
  NEW.position      := OLD.position;
  NEW.employee_code := OLD.employee_code;
  NEW.status        := OLD.status;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_personnel_self_escalation ON public.personnel;
CREATE TRIGGER prevent_personnel_self_escalation
BEFORE UPDATE ON public.personnel
FOR EACH ROW
EXECUTE FUNCTION public.prevent_personnel_self_escalation();
