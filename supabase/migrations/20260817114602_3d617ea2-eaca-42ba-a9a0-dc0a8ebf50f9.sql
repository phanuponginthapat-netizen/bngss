DROP VIEW IF EXISTS public.tmp_audit;

DO $$
DECLARE
  v record;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  FOR v IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND (c.reloptions IS NULL OR c.reloptions::text NOT LIKE '%security_invoker%')
  LOOP
    BEGIN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v.relname);
    EXCEPTION
      WHEN insufficient_privilege OR undefined_table THEN NULL;
    END;
  END LOOP;
END $$;