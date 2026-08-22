-- Sync queue for bidirectional SIS sync
CREATE TABLE IF NOT EXISTS public.sis_sync_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  entity_type text NOT NULL, -- 'student', 'staff', 'score', 'attendance'
  entity_id uuid,
  operation text NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  payload jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.sis_sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage SIS sync" ON public.sis_sync_queue FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Track sync version for conflict resolution
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS sis_sync_version integer DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS sis_last_synced_at timestamptz;
