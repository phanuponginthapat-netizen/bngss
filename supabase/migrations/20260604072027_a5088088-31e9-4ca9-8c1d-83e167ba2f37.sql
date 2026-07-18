CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, is_approved)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    true
  )
  ON CONFLICT (id) DO NOTHING;

  -- Honor role from metadata when provided (e.g. admin-created student/director),
  -- otherwise default to teacher.
  BEGIN
    v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role','')::public.app_role, 'teacher');
  EXCEPTION WHEN OTHERS THEN
    v_role := 'teacher';
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;