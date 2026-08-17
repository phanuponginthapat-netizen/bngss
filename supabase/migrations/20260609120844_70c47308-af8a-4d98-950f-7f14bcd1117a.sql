-- 1) profiles → personnel
CREATE OR REPLACE FUNCTION public.sync_profile_to_personnel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  UPDATE public.personnel SET
    first_name    = COALESCE(NEW.first_name, first_name),
    last_name     = COALESCE(NULLIF(NEW.last_name,''), last_name),
    phone         = COALESCE(NEW.phone, phone),
    employee_code = COALESCE(NULLIF(NEW.employee_code,''), employee_code),
    position      = COALESCE(NULLIF(NEW.position_title,''), position),
    department    = COALESCE(NULLIF(NEW.department,''), department),
    hire_date     = COALESCE(NEW.hire_date, hire_date),
    school_id     = COALESCE(NEW.school_id, school_id),
    updated_at    = now()
  WHERE user_id = NEW.id;

  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_profile_to_personnel ON public.profiles';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_sync_profile_to_personnel
AFTER UPDATE OF first_name, last_name, phone, employee_code, position_title, department, hire_date, school_id
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_personnel()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) personnel → profiles
CREATE OR REPLACE FUNCTION public.sync_personnel_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.profiles SET
    first_name      = COALESCE(NEW.first_name, first_name),
    last_name       = COALESCE(NULLIF(NEW.last_name,''), last_name),
    phone           = COALESCE(NEW.phone, phone),
    employee_code   = COALESCE(NULLIF(NEW.employee_code,''), employee_code),
    position_title  = COALESCE(NULLIF(NEW.position,''), position_title),
    department      = COALESCE(NULLIF(NEW.department,''), department),
    hire_date       = COALESCE(NEW.hire_date, hire_date),
    school_id       = COALESCE(NEW.school_id, school_id),
    updated_at      = now()
  WHERE id = NEW.user_id;

  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_personnel_to_profile ON public.personnel';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_sync_personnel_to_profile
AFTER UPDATE OF first_name, last_name, phone, employee_code, position, department, hire_date, school_id, user_id
ON public.personnel
FOR EACH ROW
EXECUTE FUNCTION public.sync_personnel_to_profile()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 3) Backfill personnel from profiles for linked rows
UPDATE public.personnel p SET
  first_name    = COALESCE(pr.first_name, p.first_name),
  last_name     = COALESCE(NULLIF(pr.last_name,''), p.last_name),
  phone         = COALESCE(pr.phone, p.phone),
  employee_code = COALESCE(NULLIF(pr.employee_code,''), p.employee_code),
  position      = COALESCE(NULLIF(pr.position_title,''), p.position),
  department    = COALESCE(NULLIF(pr.department,''), p.department),
  hire_date     = COALESCE(pr.hire_date, p.hire_date),
  school_id     = COALESCE(pr.school_id, p.school_id),
  updated_at    = now()
FROM public.profiles pr
WHERE p.user_id = pr.id
  AND (
       p.first_name    IS DISTINCT FROM COALESCE(pr.first_name, p.first_name)
    OR p.last_name     IS DISTINCT FROM COALESCE(NULLIF(pr.last_name,''), p.last_name)
    OR p.phone         IS DISTINCT FROM COALESCE(pr.phone, p.phone)
    OR p.employee_code IS DISTINCT FROM COALESCE(NULLIF(pr.employee_code,''), p.employee_code)
    OR p.position      IS DISTINCT FROM COALESCE(NULLIF(pr.position_title,''), p.position)
    OR p.department    IS DISTINCT FROM COALESCE(NULLIF(pr.department,''), p.department)
    OR p.hire_date     IS DISTINCT FROM COALESCE(pr.hire_date, p.hire_date)
    OR p.school_id     IS DISTINCT FROM COALESCE(pr.school_id, p.school_id)
  );
