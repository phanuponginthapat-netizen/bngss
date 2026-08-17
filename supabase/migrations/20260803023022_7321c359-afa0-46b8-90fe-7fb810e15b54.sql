DROP FUNCTION IF EXISTS public.trg_line_vault_substitute() CASCADE;
CREATE OR REPLACE FUNCTION public.trg_line_vault_substitute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_name text;
  cls_name text;
BEGIN
  SELECT name_th INTO sub_name FROM public.subjects WHERE id = NEW.subject_id;
  SELECT name INTO cls_name FROM public.classrooms WHERE id = NEW.classroom_id;
  PERFORM public.line_vault_dispatch('substitute', jsonb_build_object(
    'kind', 'substitute',
    'original', NEW.original_teacher,
    'substitute', NEW.substitute_teacher,
    'date', NEW.teaching_date,
    'period', NEW.period,
    'subject', sub_name,
    'classroom', cls_name,
    'notes', NEW.notes,
    'id', NEW.id
  ));
  RETURN NEW;
END;
$$;