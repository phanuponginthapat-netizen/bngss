
-- 1. Expand procurement_records
ALTER TABLE public.procurement_records
  ADD COLUMN IF NOT EXISTS case_type text NOT NULL DEFAULT 'case1_direct',
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'purchase',
  ADD COLUMN IF NOT EXISTS project_name text,
  ADD COLUMN IF NOT EXISTS tor_text text,
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS purchased_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleared_at timestamptz,
  ADD COLUMN IF NOT EXISTS egpeasy_number text,
  ADD COLUMN IF NOT EXISTS advance_request_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Allow requester to view own
DROP POLICY IF EXISTS "Users view own procurement requests" ON public.procurement_records;
CREATE POLICY "Users view own procurement requests" ON public.procurement_records
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

DROP POLICY IF EXISTS "Users create own procurement requests" ON public.procurement_records;
CREATE POLICY "Users create own procurement requests" ON public.procurement_records
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- 2. procurement_advances
CREATE TABLE IF NOT EXISTS public.procurement_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  borrower_id uuid NOT NULL,
  purpose text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  borrowed_at date,
  due_date date,
  approved_at timestamptz,
  disbursed_at timestamptz,
  cleared_at timestamptz,
  repaid_amount numeric NOT NULL DEFAULT 0,
  refund_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'requested',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_advances TO authenticated;
GRANT ALL ON public.procurement_advances TO service_role;

ALTER TABLE public.procurement_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Director manage advances" ON public.procurement_advances
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Borrower view own advances" ON public.procurement_advances
  FOR SELECT TO authenticated USING (borrower_id = auth.uid());

CREATE POLICY "Borrower create own advances" ON public.procurement_advances
  FOR INSERT TO authenticated WITH CHECK (borrower_id = auth.uid());

-- 3. procurement_documents
CREATE TABLE IF NOT EXISTS public.procurement_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procurement_id uuid REFERENCES public.procurement_records(id) ON DELETE CASCADE,
  advance_id uuid REFERENCES public.procurement_advances(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'attachment',
  file_name text NOT NULL,
  file_path text NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procurement_documents TO authenticated;
GRANT ALL ON public.procurement_documents TO service_role;

ALTER TABLE public.procurement_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Director manage proc docs" ON public.procurement_documents
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "Auth users view proc docs" ON public.procurement_documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users upload proc docs" ON public.procurement_documents
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_procurement_records_updated_at ON public.procurement_records;
CREATE TRIGGER trg_procurement_records_updated_at
  BEFORE UPDATE ON public.procurement_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

DROP TRIGGER IF EXISTS trg_procurement_advances_updated_at ON public.procurement_advances;
CREATE TRIGGER trg_procurement_advances_updated_at
  BEFORE UPDATE ON public.procurement_advances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_now();

-- 5. Realtime
ALTER TABLE public.procurement_advances REPLICA IDENTITY FULL;
ALTER TABLE public.procurement_documents REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.procurement_advances;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.procurement_documents;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
