CREATE OR REPLACE FUNCTION public.personnel_block_sensitive_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_privileged boolean;
BEGIN
  is_privileged := public.has_role(auth.uid(), 'admin')
                OR public.has_role(auth.uid(), 'director');
  IF is_privileged THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS NOT NULL AND OLD.user_id = auth.uid() THEN
    -- Block only identity-critical fields; allow self-editing of profile info
    IF NEW.employee_code IS DISTINCT FROM OLD.employee_code
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'ไม่มีสิทธิ์แก้ไขรหัสพนักงาน/สถานะของตนเอง (กรุณาติดต่อผู้ดูแลระบบ)'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;