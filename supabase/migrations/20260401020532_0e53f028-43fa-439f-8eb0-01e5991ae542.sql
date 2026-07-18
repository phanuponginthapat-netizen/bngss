
-- Budget/Financial tables
CREATE TABLE public.budget_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type TEXT NOT NULL DEFAULT 'expense',
  category TEXT NOT NULL DEFAULT 'operational',
  project_name TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  budget_source TEXT DEFAULT 'งบประมาณ',
  fiscal_year INTEGER DEFAULT EXTRACT(year FROM now()),
  quarter INTEGER DEFAULT 1,
  approved_by TEXT,
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.budget_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage budget_transactions" ON public.budget_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Procurement (e-GP)
CREATE TABLE public.procurement_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  procurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  procurement_type TEXT NOT NULL DEFAULT 'purchase',
  method TEXT NOT NULL DEFAULT 'เฉพาะเจาะจง',
  description TEXT NOT NULL,
  vendor_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  egp_number TEXT,
  contract_number TEXT,
  fiscal_year INTEGER DEFAULT EXTRACT(year FROM now()),
  status TEXT NOT NULL DEFAULT 'draft',
  approved_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.procurement_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage procurement_records" ON public.procurement_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Asset Management
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_code TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'ครุภัณฑ์',
  acquisition_date DATE DEFAULT CURRENT_DATE,
  acquisition_cost NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC DEFAULT 0,
  depreciation_rate NUMERIC DEFAULT 0,
  location TEXT,
  responsible_person TEXT,
  condition TEXT DEFAULT 'ปกติ',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  fiscal_year INTEGER DEFAULT EXTRACT(year FROM now()),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage assets" ON public.assets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Student Subsidies (กสศ.)
CREATE TABLE public.student_subsidies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  subsidy_type TEXT NOT NULL DEFAULT 'ปัจจัยพื้นฐาน',
  amount NUMERIC NOT NULL DEFAULT 0,
  academic_year INTEGER DEFAULT EXTRACT(year FROM now()),
  semester INTEGER DEFAULT 1,
  disbursement_date DATE,
  income_per_month NUMERIC,
  is_eligible BOOLEAN DEFAULT false,
  screening_result TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.student_subsidies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage student_subsidies" ON public.student_subsidies FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Salary records
CREATE TABLE public.salary_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE,
  salary_month INTEGER NOT NULL,
  salary_year INTEGER NOT NULL,
  base_salary NUMERIC DEFAULT 0,
  position_allowance NUMERIC DEFAULT 0,
  other_allowance NUMERIC DEFAULT 0,
  deductions NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  salary_step TEXT,
  promotion_round TEXT,
  decoration_request TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage salary_records" ON public.salary_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ID Plan (Individual Development Plan)
CREATE TABLE public.id_plan_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE,
  academic_year INTEGER DEFAULT EXTRACT(year FROM now()),
  plan_type TEXT NOT NULL DEFAULT 'training',
  title TEXT NOT NULL,
  description TEXT,
  training_hours INTEGER DEFAULT 0,
  certificate_url TEXT,
  training_date DATE,
  organizer TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.id_plan_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage id_plan_records" ON public.id_plan_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
