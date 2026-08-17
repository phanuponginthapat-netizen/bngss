DELETE FROM public.app_secrets WHERE key IN ('FB_PAGE_ACCESS_TOKEN','FB_PAGE_ID');
DROP FUNCTION IF EXISTS public.ensure_default_app_secrets() CASCADE;
CREATE OR REPLACE FUNCTION public.ensure_default_app_secrets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_secrets (key, description, category) VALUES
    ('CRON_SECRET', 'ใช้ภายในสำหรับเรียก cron จาก pg_cron (auto)', 'auto'),
    ('VAPID_PUBLIC_KEY', 'Web Push VAPID Public Key (auto)', 'auto'),
    ('VAPID_PRIVATE_KEY', 'Web Push VAPID Private Key (auto)', 'auto'),
    ('VAPID_SUBJECT', 'Web Push VAPID Subject (mailto:...) (auto)', 'auto'),
    ('LINE_CHANNEL_ACCESS_TOKEN', 'LINE OA Messaging Channel Access Token', 'line'),
    ('LINE_LOGIN_CHANNEL_ID', 'LINE Login Channel ID (LIFF)', 'line'),
    ('LINE_LIFF_CHANNEL_ID', 'LIFF Channel ID', 'line'),
    ('ELEVENLABS_API_KEY', 'ElevenLabs TTS (ตัวเลือกเสริม)', 'notifications')
  ON CONFLICT (key) DO NOTHING;
END;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'REVOKE ALL ON FUNCTION public.ensure_default_app_secrets() FROM PUBLIC, anon, authenticated';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.ensure_default_app_secrets() TO authenticated, service_role';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
