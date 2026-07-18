
CREATE OR REPLACE FUNCTION public.notify_parents_on_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE student_uuid uuid; student_name text; subj_name text; msg text;
BEGIN
  SELECT id, CONCAT(prefix, first_name, ' ', last_name) INTO student_uuid, student_name
    FROM public.students WHERE student_code = NEW.student_code LIMIT 1;
  IF student_uuid IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.grade IS NOT DISTINCT FROM OLD.grade AND NEW.total_score IS NOT DISTINCT FROM OLD.total_score THEN RETURN NEW; END IF;
  SELECT name_th INTO subj_name FROM public.subjects WHERE id = NEW.subject_id;
  msg := 'วิชา '||COALESCE(subj_name,'-')||' • คะแนนรวม '||COALESCE(NEW.total_score::text,'-')||
         CASE WHEN NEW.grade IS NOT NULL THEN ' • เกรด '||NEW.grade ELSE '' END;
  PERFORM public.send_line_to_student_parents(student_uuid, '📊 ผลคะแนน: '||COALESCE(student_name,''), msg);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gchat_on_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sname text;
  subj_name text;
  link text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.grade IS NOT DISTINCT FROM OLD.grade
     AND NEW.total_score IS NOT DISTINCT FROM OLD.total_score THEN
    RETURN NEW;
  END IF;

  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO sname
    FROM public.students WHERE student_code = NEW.student_code LIMIT 1;
  SELECT name_th INTO subj_name FROM public.subjects WHERE id = NEW.subject_id;

  link := public.app_base_url() || '/dashboard/academic/pp5?student_code=' || NEW.student_code
    || COALESCE('&subject=' || NEW.subject_id::text, '');

  PERFORM public.notify_google_chat(
    'score',
    '📊 บันทึกผลคะแนน: ' || COALESCE(sname, NEW.student_code),
    'วิชา ' || COALESCE(subj_name,'-'),
    'academic','info', link,
    jsonb_build_object(
      'คะแนนรวม', COALESCE(NEW.total_score::text,'-'),
      'เกรด', COALESCE(NEW.grade,'-')
    ),
    'student_scores', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;
