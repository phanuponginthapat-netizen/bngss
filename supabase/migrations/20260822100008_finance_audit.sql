-- 20260822100008_finance_audit.sql
-- Finance double-entry audit + month close
-- Tables: finance_audit_log, finance_month_close
-- Triggers: log_finance_change() for petty_cash and budget_transactions

-- 1) finance_audit_log
CREATE TABLE IF NOT EXISTS public.finance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finance_audit_log_table_name ON public.finance_audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_finance_audit_log_record_id ON public.finance_audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_finance_audit_log_changed_at ON public.finance_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_audit_log_action ON public.finance_audit_log(action);

ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view finance_audit_log" ON public.finance_audit_log;
CREATE POLICY "Authenticated can view finance_audit_log"
  ON public.finance_audit_log FOR SELECT
  TO authenticated
  USING (true);

-- Allow service_role / admin inserts via trigger (no direct insert policy needed, but allow authenticated insert for edge cases)
DROP POLICY IF EXISTS "Authenticated can insert finance_audit_log" ON public.finance_audit_log;
CREATE POLICY "Authenticated can insert finance_audit_log"
  ON public.finance_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE public.finance_audit_log IS 'Audit log for finance tables (petty_cash, budget_transactions) — records old/new jsonb per action';

-- 2) finance_month_close
CREATE TABLE IF NOT EXISTS public.finance_month_close (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL UNIQUE CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  petty_total numeric NOT NULL DEFAULT 0,
  budget_total numeric NOT NULL DEFAULT 0,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_finance_month_close_month ON public.finance_month_close(month);
CREATE INDEX IF NOT EXISTS idx_finance_month_close_closed_at ON public.finance_month_close(closed_at DESC);

ALTER TABLE public.finance_month_close ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view finance_month_close" ON public.finance_month_close;
CREATE POLICY "Authenticated can view finance_month_close"
  ON public.finance_month_close FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage finance_month_close" ON public.finance_month_close;
CREATE POLICY "Admins can manage finance_month_close"
  ON public.finance_month_close FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Also allow admins/directors maybe? Keep strict to admin per spec.
DROP POLICY IF EXISTS "Admins can delete finance_month_close" ON public.finance_month_close;
-- handled by FOR ALL above

GRANT SELECT ON public.finance_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.finance_audit_log TO authenticated;
GRANT SELECT ON public.finance_month_close TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_month_close TO authenticated;

COMMENT ON TABLE public.finance_month_close IS 'Monthly close for finance (petty_cash + budget_transactions) — month format YYYY-MM, e.g. 2026-08';
COMMENT ON COLUMN public.finance_month_close.month IS 'Month key YYYY-MM unique, e.g. 2026-08';
COMMENT ON COLUMN public.finance_month_close.petty_total IS 'Total petty cash amount for month (or net) at close time';
COMMENT ON COLUMN public.finance_month_close.budget_total IS 'Total budget_transactions amount for month at close time';

-- 3) Trigger function log_finance_change()
CREATE OR REPLACE FUNCTION public.log_finance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle INSERT, UPDATE, DELETE
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.finance_audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'insert', NULL, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.finance_audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.finance_audit_log (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'delete', to_jsonb(OLD), NULL, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 4) Create triggers gracefully handling missing tables
DO $$
BEGIN
  -- petty_cash trigger
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='petty_cash') THEN
    DROP TRIGGER IF EXISTS trg_log_petty_cash ON public.petty_cash;
    CREATE TRIGGER trg_log_petty_cash
      AFTER INSERT OR UPDATE OR DELETE ON public.petty_cash
      FOR EACH ROW EXECUTE FUNCTION public.log_finance_change();
  END IF;

  -- budget_transactions trigger
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='budget_transactions') THEN
    DROP TRIGGER IF EXISTS trg_log_budget_transactions ON public.budget_transactions;
    CREATE TRIGGER trg_log_budget_transactions
      AFTER INSERT OR UPDATE OR DELETE ON public.budget_transactions
      FOR EACH ROW EXECUTE FUNCTION public.log_finance_change();
  END IF;
END $$;

-- Optional: ensure RLS for audit log allows trigger inserts even without policy (SECURITY DEFINER handles it)
-- No additional view needed

SELECT 'finance_audit migration done' AS status;
