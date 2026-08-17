-- Add user_id to personnel table
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Create function to auto-link personnel when profile is created
CREATE OR REPLACE FUNCTION public.auto_link_personnel_on_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_email TEXT;
  p_employee_code TEXT;
BEGIN
  -- Get email from auth.users
  SELECT email INTO p_email FROM auth.users WHERE id = NEW.id;
  
  -- Get employee_code from profile
  p_employee_code := NEW.employee_code;
  
  -- Try to match by email first, then by employee_code
  IF p_email IS NOT NULL THEN
    UPDATE public.personnel 
    SET user_id = NEW.id 
    WHERE email = p_email AND user_id IS NULL;
  END IF;
  
  IF p_employee_code IS NOT NULL AND NOT FOUND THEN
    UPDATE public.personnel 
    SET user_id = NEW.id 
    WHERE employee_code = p_employee_code AND user_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;
-- Trigger to auto-link on profile insert/update
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trigger_auto_link_personnel ON public.profiles';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trigger_auto_link_personnel
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_link_personnel_on_profile()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Function to get current user's linked personnel record
CREATE OR REPLACE FUNCTION public.get_my_personnel()
RETURNS SETOF public.personnel
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.personnel WHERE user_id = auth.uid();
$$;
-- Function to get current user's linked student record
CREATE OR REPLACE FUNCTION public.get_my_student()
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.students WHERE auth_user_id = auth.uid();
$$;
