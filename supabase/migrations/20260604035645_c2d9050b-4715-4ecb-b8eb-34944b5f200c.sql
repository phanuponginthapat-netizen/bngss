-- Security hardening: revoke anon EXECUTE on SECURITY DEFINER functions
-- and tighten permissive RLS policies flagged by linter.

DO $$
DECLARE
  fn record;
  keep_anon text[] := ARRAY['get_public_profile']; -- callable from public QR pages
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
                   fn.proname, fn.args);
    IF fn.proname = ANY(keep_anon) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon',
                     fn.proname, fn.args);
    END IF;
    -- ensure authenticated can still call RPCs / RLS helpers
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role',
                   fn.proname, fn.args);
  END LOOP;
END $$;

-- Fix overly permissive RLS on google_chat_logs (was open to public role with WITH CHECK true)
DROP POLICY IF EXISTS "Service role can insert chat logs" ON public.google_chat_logs;
DROP POLICY IF EXISTS "Service role can insert chat logs" ON public.google_chat_logs;
CREATE POLICY "Service role can insert chat logs"
ON public.google_chat_logs
FOR INSERT
TO service_role
WITH CHECK (true);