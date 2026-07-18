
-- 1) Trigger: mirror profiles.avatar_url -> students.photo_url
CREATE OR REPLACE FUNCTION public.sync_student_photo_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url <> ''
     AND (TG_OP = 'INSERT' OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url) THEN
    UPDATE public.students
       SET photo_url = NEW.avatar_url
     WHERE auth_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_student_photo ON public.profiles;
CREATE TRIGGER profiles_sync_student_photo
AFTER INSERT OR UPDATE OF avatar_url ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_photo_from_profile();

-- 2) Backfill
UPDATE public.students s
SET photo_url = p.avatar_url
FROM public.profiles p
WHERE s.auth_user_id = p.id
  AND p.avatar_url IS NOT NULL AND p.avatar_url <> ''
  AND (s.photo_url IS NULL OR s.photo_url = '');
