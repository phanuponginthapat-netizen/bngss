
DO $$
DECLARE
  fn_record RECORD;
  fn_ident TEXT;
  whitelist TEXT[] := ARRAY[
    'app_base_url',
    'get_public_profile',
    'get_public_org_chart',
    'get_profiles_public',
    'get_personnel_directory',
    'get_staff_profiles'
  ];
BEGIN
  FOR fn_record IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
      AND NOT (p.proname = ANY(whitelist))
  LOOP
    fn_ident := format('public.%I(%s)', fn_record.proname, fn_record.args);
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn_ident);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn_ident);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %: %', fn_ident, SQLERRM;
    END;
  END LOOP;
END $$;

-- Ensure search_path set on every SECURITY DEFINER function
DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
      ))
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public',
        fn_record.proname, fn_record.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped search_path for %: %', fn_record.proname, SQLERRM;
    END;
  END LOOP;
END $$;
