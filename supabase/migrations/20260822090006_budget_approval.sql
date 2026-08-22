ALTER TABLE public.budget_transactions ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'approved' CHECK (approval_status IN ('draft','pending','approved','rejected'));
ALTER TABLE public.budget_transactions ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);
ALTER TABLE public.budget_transactions ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.budget_transactions ADD COLUMN IF NOT EXISTS rejection_reason text;
