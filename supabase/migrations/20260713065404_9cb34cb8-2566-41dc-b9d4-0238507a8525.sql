
CREATE OR REPLACE FUNCTION public.behavior_records_fill_recorder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.recorded_by IS NOT NULL AND btrim(NEW.recorded_by) <> '' THEN
    RETURN NEW;
  END IF;
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- personnel first (has prefix)
  SELECT btrim(concat_ws('', COALESCE(prefix,''), COALESCE(first_name,''), ' ', COALESCE(last_name,'')))
    INTO v_name
  FROM public.personnel WHERE user_id = v_uid LIMIT 1;

  IF v_name IS NULL OR v_name = '' THEN
    SELECT btrim(concat_ws(' ', COALESCE(first_name,''), COALESCE(last_name,'')))
      INTO v_name
    FROM public.profiles WHERE id = v_uid LIMIT 1;
  END IF;

  IF v_name IS NULL OR v_name = '' THEN
    SELECT email INTO v_name FROM auth.users WHERE id = v_uid LIMIT 1;
  END IF;

  IF v_name IS NOT NULL AND v_name <> '' THEN
    NEW.recorded_by := v_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS behavior_records_fill_recorder_trg ON public.behavior_records;
CREATE TRIGGER behavior_records_fill_recorder_trg
  BEFORE INSERT OR UPDATE ON public.behavior_records
  FOR EACH ROW EXECUTE FUNCTION public.behavior_records_fill_recorder();
