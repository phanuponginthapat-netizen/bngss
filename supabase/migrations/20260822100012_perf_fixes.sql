-- Perf fixes: student_column_scores index + face_scan_logs BRIN + school_id
CREATE INDEX IF NOT EXISTS idx_student_column_scores_col_student ON public.student_column_scores(column_id, student_id);
CREATE INDEX IF NOT EXISTS idx_student_column_scores_student ON public.student_column_scores(student_id);

-- face_scan_logs: add school_id if missing for future partitioning, add BRIN for time-range scans
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='face_scan_logs' AND column_name='school_id') THEN
    ALTER TABLE public.face_scan_logs ADD COLUMN school_id uuid;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_face_scan_logs_school_date_brin ON public.face_scan_logs USING BRIN (scan_date) WITH (pages_per_range = 128);
CREATE INDEX IF NOT EXISTS idx_face_scan_logs_student_date ON public.face_scan_logs(student_id, scan_date);

-- offline DLQ for failed syncs
CREATE TABLE IF NOT EXISTS public.offline_failed_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name text NOT NULL,
  payload jsonb NOT NULL,
  error text,
  attempts int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.offline_failed_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all offline_failed" ON public.offline_failed_queue;
CREATE POLICY "auth all offline_failed" ON public.offline_failed_queue FOR ALL TO authenticated USING (true) WITH CHECK (true);
