-- ===== 1. School Lunch Records =====
CREATE TABLE IF NOT EXISTS public.school_lunch_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lunch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  academic_year INTEGER DEFAULT EXTRACT(year FROM now()),
  semester INTEGER DEFAULT 1,
  menu_name TEXT NOT NULL,
  menu_description TEXT,
  student_count INTEGER NOT NULL DEFAULT 0,
  actual_eaters INTEGER DEFAULT 0,
  cost_per_head NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  budget_source TEXT DEFAULT 'อปท.',
  nutrition_info TEXT,
  photo_url TEXT,
  prepared_by TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.school_lunch_records ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth users can view school_lunch_records" ON public.school_lunch_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth users can view school_lunch_records" ON public.school_lunch_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Auth users can view school_lunch_records" ON public.school_lunch_records FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can manage school_lunch_records" ON public.school_lunch_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can manage school_lunch_records" ON public.school_lunch_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Staff can manage school_lunch_records" ON public.school_lunch_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), ''admin'') OR has_role(auth.uid(), ''director'') OR has_role(auth.uid(), ''teacher''))
  WITH CHECK (has_role(auth.uid(), ''admin'') OR has_role(auth.uid(), ''director'') OR has_role(auth.uid(), ''teacher''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ===== 2. School Milk Records =====
CREATE TABLE IF NOT EXISTS public.school_milk_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  academic_year INTEGER DEFAULT EXTRACT(year FROM now()),
  semester INTEGER DEFAULT 1,
  milk_type TEXT NOT NULL DEFAULT 'พาสเจอร์ไรส์',
  milk_brand TEXT,
  quantity_boxes INTEGER NOT NULL DEFAULT 0,
  student_count INTEGER NOT NULL DEFAULT 0,
  actual_recipients INTEGER DEFAULT 0,
  grade_levels TEXT[],
  supplier TEXT,
  batch_number TEXT,
  expiry_date DATE,
  temperature_check NUMERIC,
  quality_status TEXT DEFAULT 'ปกติ',
  budget_source TEXT DEFAULT 'อปท.',
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.school_milk_records ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth users can view school_milk_records" ON public.school_milk_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth users can view school_milk_records" ON public.school_milk_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Auth users can view school_milk_records" ON public.school_milk_records FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can manage school_milk_records" ON public.school_milk_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can manage school_milk_records" ON public.school_milk_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Staff can manage school_milk_records" ON public.school_milk_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), ''admin'') OR has_role(auth.uid(), ''director'') OR has_role(auth.uid(), ''teacher''))
  WITH CHECK (has_role(auth.uid(), ''admin'') OR has_role(auth.uid(), ''director'') OR has_role(auth.uid(), ''teacher''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ===== 3. Action Plans (PDCA) =====
CREATE TABLE IF NOT EXISTS public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT DEFAULT 'วิชาการ',
  fiscal_year INTEGER DEFAULT EXTRACT(year FROM now()),
  academic_year INTEGER DEFAULT EXTRACT(year FROM now()),
  strategy TEXT,
  objective TEXT,
  kpi_indicator TEXT,
  kpi_target TEXT,
  responsible_person TEXT,
  budget_amount NUMERIC DEFAULT 0,
  budget_source TEXT DEFAULT 'งบประมาณ',
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'plan',
  plan_details TEXT,
  do_details TEXT,
  check_details TEXT,
  act_details TEXT,
  plan_score INTEGER,
  do_score INTEGER,
  check_score INTEGER,
  act_score INTEGER,
  overall_result TEXT,
  attachments TEXT[],
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth users can view action_plans" ON public.action_plans';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Auth users can view action_plans" ON public.action_plans';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Auth users can view action_plans" ON public.action_plans FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can manage action_plans" ON public.action_plans';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff can manage action_plans" ON public.action_plans';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Staff can manage action_plans" ON public.action_plans FOR ALL TO authenticated
  USING (has_role(auth.uid(), ''admin'') OR has_role(auth.uid(), ''director'') OR has_role(auth.uid(), ''teacher''))
  WITH CHECK (has_role(auth.uid(), ''admin'') OR has_role(auth.uid(), ''director'') OR has_role(auth.uid(), ''teacher''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
