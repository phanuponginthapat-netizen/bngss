-- Score change history: every insert/update/delete on student_scores is written to audit_logs.
CREATE OR REPLACE FUNCTION public.audit_student_scores()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _old jsonb; _new jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN _old := jsonb_build_object('total', OLD.total_score, 'grade', OLD.grade, 'semester', OLD.semester, 'academic_year', OLD.academic_year); END IF;
  IF TG_OP <> 'DELETE' THEN _new := jsonb_build_object('total', NEW.total_score, 'grade', NEW.grade, 'semester', NEW.semester, 'academic_year', NEW.academic_year); END IF;
  IF TG_OP = 'UPDATE' AND _old = _new THEN RETURN NEW; END IF;
  INSERT INTO public.audit_logs (action, target_table, target_id, user_id, details)
  VALUES ('score_' || lower(TG_OP), 'student_scores', COALESCE(NEW.id, OLD.id)::text, auth.uid(),
          jsonb_build_object('student_code', COALESCE(NEW.student_code, OLD.student_code),
                             'subject_id', COALESCE(NEW.subject_id, OLD.subject_id), 'old', _old, 'new', _new));
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_audit_student_scores ON public.student_scores;
CREATE TRIGGER trg_audit_student_scores AFTER INSERT OR UPDATE OR DELETE ON public.student_scores
FOR EACH ROW EXECUTE FUNCTION public.audit_student_scores();
