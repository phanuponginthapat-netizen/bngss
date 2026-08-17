DO $$
DECLARE
  fn_record RECORD;
BEGIN
  FOR fn_record IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND t.typname = 'trigger'
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, authenticated, PUBLIC',
        fn_record.proname, fn_record.args);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %: %', fn_record.proname, SQLERRM;
    END;
  END LOOP;
END $$;
