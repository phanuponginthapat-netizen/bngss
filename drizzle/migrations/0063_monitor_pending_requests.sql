ALTER TABLE public.monitor_event_receipts ADD COLUMN IF NOT EXISTS handled_at timestamptz;

CREATE OR REPLACE FUNCTION public.pending_monitor_events()
RETURNS TABLE(id uuid, event jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT r.id, r.event FROM public.monitor_event_receipts r
  WHERE auth.uid() IS NOT NULL AND r.recipient = auth.uid()::text
    AND r.expires_at > now() AND r.handled_at IS NULL
    AND r.event->>'type' = 'request-stream'
  ORDER BY r.created_at DESC LIMIT 5
$$;

CREATE OR REPLACE FUNCTION public.ack_monitor_event(_id uuid)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE public.monitor_event_receipts SET handled_at = now()
  WHERE id = _id AND auth.uid() IS NOT NULL AND recipient = auth.uid()::text AND handled_at IS NULL
$$;

REVOKE ALL ON FUNCTION public.pending_monitor_events() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ack_monitor_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pending_monitor_events() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ack_monitor_event(uuid) TO authenticated;