DROP FUNCTION IF EXISTS public.trg_line_vault_staff_leave() CASCADE;
CREATE OR REPLACE FUNCTION public.trg_line_vault_staff_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pname text;
  action text;
BEGIN
  SELECT TRIM(COALESCE(prefix,'') || COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))
    INTO pname FROM public.personnel WHERE id = NEW.personnel_id;
  IF TG_OP = 'INSERT' THEN
    action := 'new';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    action := NEW.status;
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.line_vault_dispatch('leaves', jsonb_build_object(
    'kind', 'staff_leave',
    'action', action,
    'name', COALESCE(NULLIF(pname,''), 'บุคลากร'),
    'leave_type', NEW.leave_type,
    'start_date', NEW.start_date,
    'end_date', NEW.end_date,
    'reason', NEW.reason,
    'approved_by', NEW.approved_by,
    'rejected_reason', NEW.rejected_reason,
    'id', NEW.id
  ));
  RETURN NEW;
END;
$function$;