-- ENUM ของฝ่ายงานในโรงเรียน (ตามมาตรฐาน 4 ฝ่าย + ผู้บริหาร)
DO $$ BEGIN
DO $do$ BEGIN
    CREATE TYPE public.school_department AS ENUM (
    'academic',          -- ฝ่ายวิชาการ
    'student_affairs',   -- ฝ่ายกิจการนักเรียน
    'general_admin',     -- ฝ่ายบริหารงานทั่วไป
    'finance_personnel', -- ฝ่ายงบประมาณและบุคคล
    'director_office'    -- สำนักผู้อำนวยการ
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ตารางจัดเก็บฝ่ายของผู้ใช้ (1 user มีได้หลายฝ่าย)
CREATE TABLE IF NOT EXISTS public.user_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department public.school_department NOT NULL,
  is_head boolean NOT NULL DEFAULT false,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, department)
);

CREATE INDEX IF NOT EXISTS idx_user_departments_user ON public.user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_dept ON public.user_departments(department);

ALTER TABLE public.user_departments ENABLE ROW LEVEL SECURITY;

-- helper: ตรวจว่าผู้ใช้สังกัดฝ่ายนี้หรือไม่
CREATE OR REPLACE FUNCTION public.has_department(_user_id uuid, _dept public.school_department)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_departments
    WHERE user_id = _user_id AND department = _dept
  );
$$;

-- helper: ดึงรายชื่อฝ่ายของผู้ใช้
CREATE OR REPLACE FUNCTION public.get_user_departments(_user_id uuid)
RETURNS public.school_department[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(department ORDER BY department), ARRAY[]::public.school_department[])
  FROM public.user_departments WHERE user_id = _user_id;
$$;

-- RLS policies
DROP POLICY IF EXISTS "Users view own departments" ON public.user_departments;
DROP POLICY IF EXISTS "Users view own departments" ON public.user_departments;
CREATE POLICY "Users view own departments" ON public.user_departments
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'director')
);

DROP POLICY IF EXISTS "Admin manage departments" ON public.user_departments;
DROP POLICY IF EXISTS "Admin manage departments" ON public.user_departments;
CREATE POLICY "Admin manage departments" ON public.user_departments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP TRIGGER IF EXISTS update_user_departments_updated_at ON public.user_departments;
CREATE TRIGGER update_user_departments_updated_at
BEFORE UPDATE ON public.user_departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();