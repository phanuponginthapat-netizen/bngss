DROP FUNCTION IF EXISTS public.personnel_block_sensitive_self_update() CASCADE;
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
    IF NEW.employee_code IS DISTINCT FROM OLD.employee_code
       OR NEW.user_id       IS DISTINCT FROM OLD.user_id
       OR NEW.position      IS DISTINCT FROM OLD.position
       OR NEW.department    IS DISTINCT FROM OLD.department
       OR NEW.status        IS DISTINCT FROM OLD.status
       OR NEW.subject_group IS DISTINCT FROM OLD.subject_group
       OR NEW.academic_standing IS DISTINCT FROM OLD.academic_standing
       OR NEW.position_level    IS DISTINCT FROM OLD.position_level
       OR NEW.hire_date     IS DISTINCT FROM OLD.hire_date THEN
      RAISE EXCEPTION 'ไม่มีสิทธิ์แก้ไขข้อมูลตำแหน่ง/ฝ่าย/สถานะของตนเอง (กรุณาติดต่อผู้ดูแลระบบ)'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;