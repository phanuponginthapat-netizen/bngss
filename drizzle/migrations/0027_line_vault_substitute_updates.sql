CREATE OR REPLACE FUNCTION public.trg_line_vault_substitute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  sub_name text; cls_name text; k text := 'substitute'; prev text := NULL;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('released','cancelled') THEN
      k := NEW.status;
    ELSIF COALESCE(NEW.substitute_teacher,'') IS DISTINCT FROM COALESCE(OLD.substitute_teacher,'')
          AND COALESCE(NEW.substitute_teacher,'') <> '' THEN
      k := CASE WHEN COALESCE(OLD.substitute_teacher,'') = '' THEN 'substitute' ELSE 'changed' END;
      prev := OLD.substitute_teacher;
    ELSE
      RETURN NEW;
    END IF;
  END IF;
  SELECT name_th INTO sub_name FROM public.subjects WHERE id = NEW.subject_id;
  SELECT name INTO cls_name FROM public.classrooms WHERE id = NEW.classroom_id;
  PERFORM public.line_vault_dispatch('substitute', jsonb_build_object(
    'kind', k, 'previous', prev,
    'original', NEW.original_teacher, 'substitute', NEW.substitute_teacher,
    'date', NEW.teaching_date, 'period', NEW.period,
    'subject', sub_name, 'classroom', cls_name, 'notes', NEW.notes, 'id', NEW.id));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS line_vault_substitute_upd ON public.substitute_teaching;
CREATE TRIGGER line_vault_substitute_upd AFTER UPDATE ON public.substitute_teaching
FOR EACH ROW EXECUTE FUNCTION public.trg_line_vault_substitute();