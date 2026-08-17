-- Notify all admin users at once
DROP FUNCTION IF EXISTS public.notify_admins(text, text, text, text, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.notify_admins(
  _title text,
  _message text,
  _type text DEFAULT 'system_alert',
  _reference_type text DEFAULT NULL,
  _reference_id uuid DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count int := 0;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id, is_read)
  SELECT ur.user_id, _title, _message, _type, _reference_type, _reference_id, false
  FROM public.user_roles ur
  WHERE ur.role = 'admin'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_admins(text,text,text,text,uuid) FROM PUBLIC, anon';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.notify_admins(text,text,text,text,uuid) TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Realtime
DO $$
BEGIN
  BEGIN
          IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'error_logs'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.error_logs;
      END IF;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
          IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'ai_provider_keys'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_provider_keys;
      END IF;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
