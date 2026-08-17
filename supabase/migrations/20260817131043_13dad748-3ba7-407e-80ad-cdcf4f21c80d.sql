CREATE TABLE IF NOT EXISTS public.smart_gate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  device_label text,
  subject_kind text NOT NULL DEFAULT 'student',
  subject_id uuid,
  subject_name text,
  event_type text NOT NULL,
  temperature_c numeric(4,1),
  metal_level integer,
  detail text,
  allowed boolean NOT NULL DEFAULT true,
  gate_opened boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smart_gate_events_time ON public.smart_gate_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_smart_gate_events_type ON public.smart_gate_events (event_type, occurred_at DESC);

GRANT SELECT, INSERT ON public.smart_gate_events TO authenticated;
GRANT ALL ON public.smart_gate_events TO service_role;

ALTER TABLE public.smart_gate_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='smart_gate_events' AND policyname='smart_gate_events_staff_select') THEN
    CREATE POLICY "smart_gate_events_staff_select" ON public.smart_gate_events
      FOR SELECT TO authenticated USING (public.is_staff_user(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='smart_gate_events' AND policyname='smart_gate_events_staff_insert') THEN
    CREATE POLICY "smart_gate_events_staff_insert" ON public.smart_gate_events
      FOR INSERT TO authenticated WITH CHECK (public.is_staff_user(auth.uid()));
  END IF;
END $$;