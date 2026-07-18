CREATE OR REPLACE FUNCTION public.auto_fill_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  IF NEW.school_id IS NULL THEN
    -- 1) Try the operating user's school
    v_school_id := public.get_user_school_id(auth.uid());
    -- 2) Fallback: if there is exactly one school, use it
    IF v_school_id IS NULL THEN
      SELECT id INTO v_school_id
      FROM public.schools
      LIMIT 2;
      -- (only set when exactly one row exists)
      IF (SELECT count(*) FROM public.schools) = 1 THEN
        SELECT id INTO v_school_id FROM public.schools LIMIT 1;
      ELSE
        v_school_id := NULL;
      END IF;
    END IF;
    NEW.school_id := v_school_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_auto_school ON public.students;
CREATE TRIGGER trg_students_auto_school
BEFORE INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id();

DROP TRIGGER IF EXISTS trg_personnel_auto_school ON public.personnel;
CREATE TRIGGER trg_personnel_auto_school
BEFORE INSERT ON public.personnel
FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id();