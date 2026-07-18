
-- Change default value of is_approved to true
ALTER TABLE public.profiles ALTER COLUMN is_approved SET DEFAULT true;

-- Update all existing unapproved profiles
UPDATE public.profiles SET is_approved = true WHERE is_approved = false;

-- Update the trigger function to set is_approved = true
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
    true
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'teacher');
  RETURN NEW;
END;
$function$;
