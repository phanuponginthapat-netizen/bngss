DROP FUNCTION IF EXISTS public.ensure_personnel_required_fields() CASCADE;
CREATE OR REPLACE FUNCTION public.ensure_personnel_required_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.employee_code := COALESCE(
    NULLIF(btrim(NEW.employee_code), ''),
    'EMP-' || substr(COALESCE(NEW.user_id, NEW.id)::text, 1, 8)
  );
  NEW.first_name := COALESCE(NEW.first_name, '');
  NEW.last_name := COALESCE(NEW.last_name, '');
  NEW.position := COALESCE(NULLIF(btrim(NEW.position), ''), 'ครู');
  NEW.department := COALESCE(NULLIF(btrim(NEW.department), ''), 'วิชาการ');
  NEW.status := COALESCE(NULLIF(btrim(NEW.status), ''), 'active');

  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_ensure_personnel_employee_code ON public.personnel';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_ensure_personnel_required_fields ON public.personnel';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_ensure_personnel_required_fields
BEFORE INSERT OR UPDATE OF employee_code, first_name, last_name, position, department, status, user_id
ON public.personnel
FOR EACH ROW EXECUTE FUNCTION public.ensure_personnel_required_fields()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DROP FUNCTION IF EXISTS public.ensure_personnel_from_profile() CASCADE;
CREATE OR REPLACE FUNCTION public.ensure_personnel_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pr RECORD;
BEGIN
  IF NEW.role NOT IN ('teacher','director','admin') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.personnel WHERE user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO pr FROM public.profiles WHERE id = NEW.user_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.personnel (
    user_id, employee_code, prefix, first_name, last_name,
    position, department, phone, email, status, school_id
  )
  VALUES (
    NEW.user_id,
    COALESCE(NULLIF(btrim(pr.employee_code), ''), 'EMP-' || substr(NEW.user_id::text, 1, 8)),
    NULL,
    COALESCE(pr.first_name, ''),
    COALESCE(pr.last_name, ''),
    COALESCE(NULLIF(btrim(pr.position_title), ''), 'ครู'),
    COALESCE(NULLIF(btrim(pr.department), ''), 'วิชาการ'),
    pr.phone,
    NULL,
    'active',
    pr.school_id
  )
  ON CONFLICT (employee_code) DO NOTHING;

  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_ensure_personnel_from_profile ON public.user_roles';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_ensure_personnel_from_profile
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.ensure_personnel_from_profile()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DROP FUNCTION IF EXISTS public.sync_profile_to_personnel() CASCADE;
CREATE OR REPLACE FUNCTION public.sync_profile_to_personnel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  UPDATE public.personnel
  SET
    first_name    = COALESCE(NEW.first_name, first_name),
    last_name     = COALESCE(NULLIF(btrim(NEW.last_name), ''), last_name),
    phone         = COALESCE(NEW.phone, phone),
    position      = COALESCE(NULLIF(btrim(NEW.position_title), ''), position),
    department    = COALESCE(NULLIF(btrim(NEW.department), ''), department),
    employee_code = COALESCE(NULLIF(btrim(NEW.employee_code), ''), employee_code),
    hire_date     = COALESCE(NEW.hire_date, hire_date),
    school_id     = COALESCE(NEW.school_id, school_id),
    updated_at    = now()
  WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;
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
AFTER UPDATE OF first_name, last_name, phone, position_title, department, employee_code, hire_date, school_id
ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_personnel()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DROP FUNCTION IF EXISTS public.sync_personnel_to_profile() CASCADE;
CREATE OR REPLACE FUNCTION public.sync_personnel_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.profiles
  SET
    first_name     = COALESCE(NEW.first_name, first_name),
    last_name      = COALESCE(NULLIF(btrim(NEW.last_name), ''), last_name),
    phone          = COALESCE(NEW.phone, phone),
    position_title = COALESCE(NULLIF(btrim(NEW.position), ''), position_title),
    department     = COALESCE(NULLIF(btrim(NEW.department), ''), department),
    employee_code  = COALESCE(NULLIF(btrim(NEW.employee_code), ''), employee_code),
    hire_date      = COALESCE(NEW.hire_date, hire_date),
    school_id      = COALESCE(NEW.school_id, school_id),
    updated_at     = now()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;
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
AFTER INSERT OR UPDATE OF first_name, last_name, phone, position, department, employee_code, hire_date, school_id, user_id
ON public.personnel
FOR EACH ROW EXECUTE FUNCTION public.sync_personnel_to_profile()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
INSERT INTO public.personnel (
  user_id, employee_code, first_name, last_name,
  position, department, phone, status, school_id
)
SELECT DISTINCT ON (ur.user_id)
  ur.user_id,
  COALESCE(NULLIF(btrim(pr.employee_code), ''), 'EMP-' || substr(ur.user_id::text, 1, 8)),
  COALESCE(pr.first_name, ''),
  COALESCE(pr.last_name, ''),
  COALESCE(NULLIF(btrim(pr.position_title), ''), 'ครู'),
  COALESCE(NULLIF(btrim(pr.department), ''), 'วิชาการ'),
  pr.phone,
  'active',
  pr.school_id
FROM public.user_roles ur
JOIN public.profiles pr ON pr.id = ur.user_id
LEFT JOIN public.personnel p ON p.user_id = ur.user_id
WHERE ur.role IN ('teacher','director','admin')
  AND p.id IS NULL
ON CONFLICT (employee_code) DO NOTHING;
