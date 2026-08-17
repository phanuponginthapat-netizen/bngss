-- Add notification_types column to google_chat_webhooks for event category filtering
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.google_chat_webhooks ADD COLUMN IF NOT EXISTS notification_types text[] DEFAULT ARRAY[''staff_leave'',''substitute'',''document'',''emergency'',''attendance'',''behavior'',''news'',''enrollment'',''assessment'',''grades'']::text[]';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Add custom_messages jsonb column for per-event message templates
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.google_chat_webhooks ADD COLUMN IF NOT EXISTS custom_messages jsonb DEFAULT ''{}''::jsonb';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
