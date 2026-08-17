CREATE OR REPLACE FUNCTION public.enforce_eform_recipient_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_allowed boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.recipient_id
      AND role IN ('teacher','director','admin')
  ) INTO has_allowed;

  IF NOT has_allowed THEN
    RAISE EXCEPTION 'ผู้รับ E-form ต้องเป็นครู, ผู้อำนวยการ หรือผู้ดูแลระบบเท่านั้น';
  END IF;

  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_enforce_eform_recipient_role ON public.eform_recipients';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_enforce_eform_recipient_role
BEFORE INSERT OR UPDATE OF recipient_id ON public.eform_recipients
FOR EACH ROW
EXECUTE FUNCTION public.enforce_eform_recipient_role()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
