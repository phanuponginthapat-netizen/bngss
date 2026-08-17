DROP VIEW IF EXISTS public.ai_usage_summary;
CREATE OR REPLACE VIEW public.ai_usage_summary
WITH (security_invoker=on) AS
SELECT
  l.user_id,
  COUNT(*) FILTER (WHERE l.role='user') AS messages_sent,
  COUNT(*) FILTER (WHERE l.role='user' AND l.risk_level IN ('medium','high')) AS risky_messages,
  COUNT(*) FILTER (WHERE l.role='user' AND l.sentiment='negative') AS negative_messages,
  COUNT(*) FILTER (WHERE l.role='user' AND l.sentiment='positive') AS positive_messages,
  MAX(l.created_at) AS last_used_at,
  COUNT(DISTINCT date_trunc('day', l.created_at)) AS active_days,
  mode() WITHIN GROUP (ORDER BY l.topic) FILTER (WHERE l.role='user') AS top_topic
FROM public.ai_chat_logs l
GROUP BY l.user_id;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'GRANT SELECT ON public.ai_usage_summary TO authenticated';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
