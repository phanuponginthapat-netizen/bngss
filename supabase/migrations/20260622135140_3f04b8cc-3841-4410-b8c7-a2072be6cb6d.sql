CREATE OR REPLACE FUNCTION public.auto_assign_school_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE only_school uuid;
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT id INTO only_school FROM public.schools WHERE is_active = true ORDER BY created_at LIMIT 1;
    NEW.school_id := only_school;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_auto_school ON public.profiles;
CREATE TRIGGER trg_profiles_auto_school
  BEFORE INSERT OR UPDATE OF school_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_school_id();

UPDATE public.profiles
   SET school_id = (SELECT id FROM public.schools WHERE is_active = true ORDER BY created_at LIMIT 1)
 WHERE school_id IS NULL;