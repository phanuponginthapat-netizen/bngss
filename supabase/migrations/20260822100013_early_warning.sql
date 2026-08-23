-- Early Warning dropout prediction — table early_warnings
-- รองรับ calculateRisk(studentId) → risk_level + reasons[], getAtRiskStudents() → high risk list, cron daily

-- 1) Table
CREATE TABLE IF NOT EXISTS public.early_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  risk_level text NOT NULL CHECK (risk_level IN ('low','medium','high')),
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  score int NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  notified boolean NOT NULL DEFAULT false,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add details/score columns if table existed from older migration without them
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='early_warnings' AND column_name='score') THEN
    ALTER TABLE public.early_warnings ADD COLUMN score int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='early_warnings' AND column_name='details') THEN
    ALTER TABLE public.early_warnings ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='early_warnings' AND column_name='notified_at') THEN
    ALTER TABLE public.early_warnings ADD COLUMN notified_at timestamptz;
  END IF;
END $$;

-- 2) Indexes
CREATE INDEX IF NOT EXISTS idx_early_warnings_student_id ON public.early_warnings(student_id);
CREATE INDEX IF NOT EXISTS idx_early_warnings_risk_level ON public.early_warnings(risk_level);
CREATE INDEX IF NOT EXISTS idx_early_warnings_calculated_at ON public.early_warnings(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_early_warnings_notified ON public.early_warnings(notified) WHERE notified = false;
CREATE INDEX IF NOT EXISTS idx_early_warnings_student_risk ON public.early_warnings(student_id, risk_level);

-- 3) RLS
ALTER TABLE public.early_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view early_warnings" ON public.early_warnings;
CREATE POLICY "Authenticated can view early_warnings"
  ON public.early_warnings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Teachers and admins can manage early_warnings" ON public.early_warnings;
CREATE POLICY "Teachers and admins can manage early_warnings"
  ON public.early_warnings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','director','teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','director','teacher')
    )
  );

-- Service role bypass (for cron edge function via service_role key) is implicit — no RLS for service_role

GRANT SELECT ON public.early_warnings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.early_warnings TO authenticated;

-- 4) Helper function for cron deduplication (optional)
CREATE OR REPLACE FUNCTION public.upsert_early_warning(
  p_student_id uuid,
  p_risk_level text,
  p_reasons jsonb,
  p_score int,
  p_details jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.early_warnings (student_id, risk_level, reasons, score, details, calculated_at, notified)
  VALUES (p_student_id, p_risk_level, p_reasons, p_score, p_details, now(), false)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 5) pg_cron schedule — daily 07:00 Bangkok (00:00 UTC) → calls early-warning-cron edge function
-- Uses pg_net http_post if available; falls back to no-op when extensions missing
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'early-warning-cron-daily',
      '0 0 * * *',
      $cron$
        SELECT net.http_post(
          url := (SELECT COALESCE(value->>'url', value::text) FROM app_secrets WHERE key='supabase_url' UNION ALL SELECT current_setting('app.supabase_url', true) LIMIT 1) || '/functions/v1/early-warning-cron',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'x-cron-secret', (SELECT COALESCE(value, '') FROM app_secrets WHERE key='cron_secret' LIMIT 1),
            'Authorization', 'Bearer ' || (SELECT COALESCE(value, '') FROM app_secrets WHERE key='service_role_key' LIMIT 1)
          ),
          body := '{"trigger":"cron"}'::jsonb
        );
      $cron$
    );
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'early-warning cron schedule skipped: %', SQLERRM;
END $outer$;

COMMENT ON TABLE public.early_warnings IS 'Early Warning dropout prediction — risk_level low/medium/high, reasons jsonb, calculated_at, notified';
