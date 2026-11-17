CREATE OR REPLACE FUNCTION public.pending_monitor_events()
 RETURNS TABLE(id uuid, event jsonb, created_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.event, r.created_at FROM public.monitor_event_receipts r
  WHERE auth.uid() IS NOT NULL AND r.recipient = auth.uid()::text
    AND r.expires_at > now() AND r.handled_at IS NULL
    AND r.event->>'type' IN ('request-stream', 'stop-stream', 'command')
  ORDER BY r.created_at DESC LIMIT 20
$$;