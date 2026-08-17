-- Add is_approved column
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Auto-approve existing admin
UPDATE public.profiles SET is_approved = true 
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');
-- Update handle_new_user to set is_approved = false for new signups
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    false
  );
  -- Default role: teacher
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'teacher');
  RETURN NEW;
END;
$function$;
