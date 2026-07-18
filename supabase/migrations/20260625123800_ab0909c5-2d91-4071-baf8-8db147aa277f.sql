
-- Backfill all profiles missing school_id with the single active school
UPDATE public.profiles p
SET school_id = s.id
FROM (SELECT id FROM public.schools WHERE is_active = true LIMIT 1) s
WHERE p.school_id IS NULL;

-- Update new-user trigger to auto-assign default school_id
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_school_id uuid;
BEGIN
  SELECT id INTO v_school_id FROM public.schools WHERE is_active = true ORDER BY created_at LIMIT 1;

  INSERT INTO public.profiles (id, first_name, last_name, is_approved, school_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    true,
    COALESCE((NEW.raw_user_meta_data->>'school_id')::uuid, v_school_id)
  )
  ON CONFLICT (id) DO UPDATE SET school_id = COALESCE(public.profiles.school_id, EXCLUDED.school_id);

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
