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
BEGIN
  EXECUTE 'GRANT SELECT ON public.ai_usage_summary TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
