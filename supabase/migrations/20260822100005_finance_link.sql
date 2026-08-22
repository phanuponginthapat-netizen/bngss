-- 20260822100005_finance_link.sql
-- Enhance finance linking: petty_cash <-> budget_transactions + daily summary view
-- Requirements:
-- 1. Add FK column petty_cash.budget_transaction_id -> budget_transactions.id
-- 2. Create view finance_daily_summary linking petty_cash + budget_transactions

-- 1. FK column (safe if already exists)
ALTER TABLE public.petty_cash
  ADD COLUMN IF NOT EXISTS budget_transaction_id uuid REFERENCES public.budget_transactions(id) ON DELETE SET NULL;

-- Helpful indexes for reconciliation & reporting
CREATE INDEX IF NOT EXISTS idx_petty_cash_budget_transaction_id ON public.petty_cash(budget_transaction_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_date ON public.petty_cash(date);
CREATE INDEX IF NOT EXISTS idx_petty_cash_type ON public.petty_cash(type);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_date ON public.budget_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_type ON public.budget_transactions(transaction_type);

-- 2. View: finance_daily_summary
-- Groups by calendar date, sums petty_cash in/out and budget income/expense, provides combined net.
-- Uses UNION of distinct dates from both tables so days with only one source still appear.
CREATE OR REPLACE VIEW public.finance_daily_summary AS
WITH dates AS (
  SELECT date::date AS summary_date FROM public.petty_cash
  UNION
  SELECT transaction_date::date AS summary_date FROM public.budget_transactions
  WHERE transaction_date IS NOT NULL
),
petty_agg AS (
  SELECT
    date::date AS d,
    COALESCE(SUM(CASE WHEN type = 'in'  THEN amount ELSE 0 END), 0) AS petty_in,
    COALESCE(SUM(CASE WHEN type = 'out' THEN amount ELSE 0 END), 0) AS petty_out,
    COUNT(*)::int AS petty_count
  FROM public.petty_cash
  GROUP BY date::date
),
budget_agg AS (
  SELECT
    transaction_date::date AS d,
    COALESCE(SUM(CASE WHEN transaction_type = 'income'  THEN amount ELSE 0 END), 0) AS budget_income,
    COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) AS budget_expense,
    COUNT(*)::int AS budget_count
  FROM public.budget_transactions
  GROUP BY transaction_date::date
)
SELECT
  d.summary_date::date AS date,
  COALESCE(p.petty_in, 0)::numeric  AS petty_in,
  COALESCE(p.petty_out, 0)::numeric AS petty_out,
  (COALESCE(p.petty_in, 0) - COALESCE(p.petty_out, 0))::numeric AS petty_net,
  COALESCE(p.petty_count, 0)::int    AS petty_count,
  COALESCE(b.budget_income, 0)::numeric  AS budget_income,
  COALESCE(b.budget_expense, 0)::numeric AS budget_expense,
  (COALESCE(b.budget_income, 0) - COALESCE(b.budget_expense, 0))::numeric AS budget_net,
  COALESCE(b.budget_count, 0)::int   AS budget_count,
  -- combined daily net (all income - all expense)
  ((COALESCE(p.petty_in, 0) + COALESCE(b.budget_income, 0)) - (COALESCE(p.petty_out, 0) + COALESCE(b.budget_expense, 0)))::numeric AS combined_net
FROM dates d
LEFT JOIN petty_agg  p ON p.d = d.summary_date
LEFT JOIN budget_agg b ON b.d = d.summary_date
ORDER BY d.summary_date DESC;

-- Grants & comment
GRANT SELECT ON public.finance_daily_summary TO authenticated;
GRANT SELECT ON public.finance_daily_summary TO anon;
GRANT SELECT ON public.finance_daily_summary TO service_role;

COMMENT ON VIEW public.finance_daily_summary IS 'สรุปรายวัน linking petty_cash + budget_transactions (petty_in/out/net, budget_income/expense/net, combined_net) - finance_link 2026-08-22';
COMMENT ON COLUMN public.petty_cash.budget_transaction_id IS 'FK -> budget_transactions.id สำหรับ โอนเข้างบประมาณ เมื่อ petty_cash out > 5000';

-- Optional: helper function to transfer (kept simple, not used by RLS directly)
-- Allows future app to call rpc if needed
DO $$
BEGIN
  -- ensure RLS policies allow admin to update linking column
  -- petty_cash already has "Admins manage petty cash" FOR ALL, so no extra policy needed
  NULL;
END $$;
