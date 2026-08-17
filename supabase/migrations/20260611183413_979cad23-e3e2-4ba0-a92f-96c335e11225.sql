CREATE OR REPLACE FUNCTION public.get_personnel_avatars(_user_ids uuid[])
RETURNS TABLE (id uuid, avatar_url text, position_title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.id, pr.avatar_url, pr.position_title
  FROM public.profiles pr
  WHERE pr.id = ANY(_user_ids);
$$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_personnel_avatars(uuid[]) TO anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
