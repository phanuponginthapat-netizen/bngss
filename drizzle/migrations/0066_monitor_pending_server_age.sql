DROP FUNCTION IF EXISTS public.pending_monitor_events();
CREATE FUNCTION public.pending_monitor_events()
RETURNS TABLE(id uuid, event jsonb, created_at timestamptz, age_ms bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.event, r.created_at,
         (extract(epoch FROM (clock_timestamp() - r.created_at)) * 1000)::bigint AS age_ms
  FROM public.monitor_event_receipts r
  WHERE auth.uid() IS NOT NULL AND r.recipient = auth.uid()::text
    AND r.expires_at > now() AND r.handled_at IS NULL
    AND r.event->>'type' IN ('request-stream', 'stop-stream', 'command')
  ORDER BY r.created_at DESC LIMIT 20
$$;
REVOKE ALL ON FUNCTION public.pending_monitor_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pending_monitor_events() TO authenticated;