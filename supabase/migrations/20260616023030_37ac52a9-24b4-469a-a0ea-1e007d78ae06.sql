ALTER TABLE public.id_plan_records
  ADD COLUMN IF NOT EXISTS order_ref_type_other TEXT;