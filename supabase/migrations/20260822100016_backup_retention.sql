-- Backup retention policy: delete backups older than 30 days, keep last 10 snapshots
-- Covers public.backup_snapshots used by backup-snapshot (zip verification) and backup-to-external
-- Idempotent: safe to re-run

-- 1) Ensure backup_snapshots table exists (compatible with external Supabase project)
CREATE TABLE IF NOT EXISTS public.backup_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  row_count int,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (table_name, snapshot_date)
);

-- 2) Add retention/verification columns if table existed with old schema
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='backup_snapshots' AND column_name='file_name') THEN
    ALTER TABLE public.backup_snapshots ADD COLUMN file_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='backup_snapshots' AND column_name='file_size') THEN
    ALTER TABLE public.backup_snapshots ADD COLUMN file_size bigint;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='backup_snapshots' AND column_name='status') THEN
    ALTER TABLE public.backup_snapshots ADD COLUMN status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','verified','failed','pending'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='backup_snapshots' AND column_name='verification_log') THEN
    ALTER TABLE public.backup_snapshots ADD COLUMN verification_log jsonb;
  END IF;
END $$;

-- Normalize status check: ensure it allows verified/failed (re-create constraint if needed)
DO $$ BEGIN
  ALTER TABLE public.backup_snapshots DROP CONSTRAINT IF EXISTS backup_snapshots_status_check;
  ALTER TABLE public.backup_snapshots ADD CONSTRAINT backup_snapshots_status_check CHECK (status IN ('success','verified','failed','pending'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- 3) Indexes for retention queries
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_created_at ON public.backup_snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_table_date ON public.backup_snapshots(table_name, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_status ON public.backup_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_snapshot_date ON public.backup_snapshots(snapshot_date DESC);

-- 4) RLS
ALTER TABLE public.backup_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view backup_snapshots" ON public.backup_snapshots;
CREATE POLICY "Authenticated can view backup_snapshots"
  ON public.backup_snapshots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can manage backup_snapshots" ON public.backup_snapshots;
CREATE POLICY "Authenticated can manage backup_snapshots"
  ON public.backup_snapshots FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage backup_snapshots" ON public.backup_snapshots;
CREATE POLICY "Service role can manage backup_snapshots"
  ON public.backup_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_snapshots TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 5) Retention function: delete backups older than 30 days, keep last 10 (by created_at)
-- Keeps last 10 newest rows regardless of age, deletes only rows older than 30 days beyond that
CREATE OR REPLACE FUNCTION public.cleanup_backup_retention() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted int := 0;
  v_keep_ids uuid[];
BEGIN
  -- Keep last 10 newest backups unconditionally
  SELECT array_agg(id) INTO v_keep_ids
  FROM (SELECT id FROM public.backup_snapshots ORDER BY created_at DESC LIMIT 10) s;

  DELETE FROM public.backup_snapshots
  WHERE created_at < now() - interval '30 days'
    AND id <> ALL(COALESCE(v_keep_ids, ARRAY[]::uuid[]));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;

COMMENT ON FUNCTION public.cleanup_backup_retention() IS 'Retention: delete backups older than 30 days, keep last 10 newest (by created_at)';

-- Alternative helper: retention by snapshot_date (keeps last 10 distinct dates)
CREATE OR REPLACE FUNCTION public.cleanup_backup_retention_by_date() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_deleted int := 0;
  v_keep_dates date[];
BEGIN
  SELECT array_agg(snapshot_date) INTO v_keep_dates
  FROM (SELECT DISTINCT snapshot_date FROM public.backup_snapshots ORDER BY snapshot_date DESC LIMIT 10) s;

  DELETE FROM public.backup_snapshots
  WHERE snapshot_date < CURRENT_DATE - 30
    AND snapshot_date <> ALL(COALESCE(v_keep_dates, ARRAY[]::date[]));

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;

-- 6) pg_cron schedule: daily 02:00 Bangkok = 19:00 UTC
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.schedule(
        'backup-retention-daily',
        '0 19 * * *',
        $$SELECT public.cleanup_backup_retention(); SELECT public.cleanup_backup_retention_by_date();$$
      );
    EXCEPTION WHEN duplicate_object THEN
      -- already scheduled, update it
      PERFORM cron.unschedule('backup-retention-daily');
      PERFORM cron.schedule(
        'backup-retention-daily',
        '0 19 * * *',
        $$SELECT public.cleanup_backup_retention(); SELECT public.cleanup_backup_retention_by_date();$$
      );
    WHEN others THEN
      RAISE NOTICE 'backup retention cron schedule failed: %', SQLERRM;
    END;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'backup retention cron skipped: %', SQLERRM;
END $outer$;

COMMENT ON TABLE public.backup_snapshots IS 'Backup snapshots + zip verification log; retention 30 days / keep last 10 via cleanup_backup_retention()';
