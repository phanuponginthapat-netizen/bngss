-- ============ TABLES ============

-- ประเภทขยะที่รับฝาก
CREATE TABLE IF NOT EXISTS public.garbage_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  points_per_unit NUMERIC NOT NULL CHECK (points_per_unit >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- สินค้ารางวัล
CREATE TABLE IF NOT EXISTS public.garbage_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT,
  points_cost INT NOT NULL CHECK (points_cost > 0),
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- ยอดแต้มรวมต่อนักเรียน (denormalized cache)
CREATE TABLE IF NOT EXISTS public.garbage_student_points (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  total_points INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- บันทึกการฝากขยะ
CREATE TABLE IF NOT EXISTS public.garbage_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.garbage_items(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  points_earned INT NOT NULL CHECK (points_earned >= 0),
  recorded_by UUID REFERENCES auth.users(id),
  recorded_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- บันทึกการแลกรางวัล
CREATE TABLE IF NOT EXISTS public.garbage_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES public.garbage_rewards(id),
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  points_used INT NOT NULL CHECK (points_used > 0),
  recorded_by UUID REFERENCES auth.users(id),
  recorded_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_garbage_deposits_student ON public.garbage_deposits(student_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_garbage_deposits_created ON public.garbage_deposits(created_at DESC)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_garbage_deposits_item ON public.garbage_deposits(item_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_garbage_redemptions_student ON public.garbage_redemptions(student_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_garbage_redemptions_created ON public.garbage_redemptions(created_at DESC)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- ============ TRIGGERS ============

-- updated_at
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_garbage_items_updated ON public.garbage_items';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_garbage_items_updated BEFORE UPDATE ON public.garbage_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_garbage_rewards_updated ON public.garbage_rewards';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_garbage_rewards_updated BEFORE UPDATE ON public.garbage_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- บวกแต้มเมื่อฝากขยะ
CREATE OR REPLACE FUNCTION public.add_points_on_deposit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.garbage_student_points (student_id, total_points, updated_at)
  VALUES (NEW.student_id, NEW.points_earned, now())
  ON CONFLICT (student_id) DO UPDATE
    SET total_points = public.garbage_student_points.total_points + NEW.points_earned,
        updated_at = now();
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_garbage_deposit_add_points ON public.garbage_deposits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_garbage_deposit_add_points
  AFTER INSERT ON public.garbage_deposits
  FOR EACH ROW EXECUTE FUNCTION public.add_points_on_deposit()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- หักแต้ม + ตัดสต๊อก เมื่อแลกของ (ตรวจ balance ใน trigger BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.process_redemption()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_points INT;
  current_stock INT;
BEGIN
  SELECT total_points INTO current_points FROM public.garbage_student_points WHERE student_id = NEW.student_id;
  IF current_points IS NULL THEN current_points := 0; END IF;
  IF current_points < NEW.points_used THEN
    RAISE EXCEPTION 'แต้มไม่เพียงพอ (มี % แต้ม ต้องใช้ % แต้ม)', current_points, NEW.points_used;
  END IF;

  SELECT stock INTO current_stock FROM public.garbage_rewards WHERE id = NEW.reward_id FOR UPDATE;
  IF current_stock IS NULL OR current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'สต๊อกไม่เพียงพอ (เหลือ % ชิ้น)', COALESCE(current_stock, 0);
  END IF;

  UPDATE public.garbage_rewards SET stock = stock - NEW.quantity, updated_at = now() WHERE id = NEW.reward_id;
  UPDATE public.garbage_student_points
    SET total_points = total_points - NEW.points_used, updated_at = now()
    WHERE student_id = NEW.student_id;

  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_garbage_redemption_process ON public.garbage_redemptions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_garbage_redemption_process
  BEFORE INSERT ON public.garbage_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.process_redemption()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============ RLS ============

DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.garbage_items ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.garbage_rewards ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.garbage_deposits ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.garbage_redemptions ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.garbage_student_points ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- items: ทุกคนที่ login เห็น, จัดการเฉพาะ admin/director/teacher
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_items_select" ON public.garbage_items';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_items_select" ON public.garbage_items';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_items_select" ON public.garbage_items FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_items_manage" ON public.garbage_items';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_items_manage" ON public.garbage_items';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_items_manage" ON public.garbage_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director'') OR has_role(auth.uid(),''teacher''))
  WITH CHECK (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director'') OR has_role(auth.uid(),''teacher''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- rewards: เหมือน items
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_rewards_select" ON public.garbage_rewards';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_rewards_select" ON public.garbage_rewards';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_rewards_select" ON public.garbage_rewards FOR SELECT TO authenticated USING (true)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_rewards_manage" ON public.garbage_rewards';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_rewards_manage" ON public.garbage_rewards';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_rewards_manage" ON public.garbage_rewards FOR ALL TO authenticated
  USING (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director'') OR has_role(auth.uid(),''teacher''))
  WITH CHECK (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director'') OR has_role(auth.uid(),''teacher''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- deposits: staff จัดการได้, นักเรียนเห็นของตัวเอง
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_deposits_select_staff" ON public.garbage_deposits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_deposits_select_staff" ON public.garbage_deposits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_deposits_select_staff" ON public.garbage_deposits FOR SELECT TO authenticated
  USING (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director'') OR has_role(auth.uid(),''teacher''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_deposits_select_student_self" ON public.garbage_deposits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_deposits_select_student_self" ON public.garbage_deposits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_deposits_select_student_self" ON public.garbage_deposits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.auth_user_id = auth.uid()))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_deposits_insert_staff" ON public.garbage_deposits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_deposits_insert_staff" ON public.garbage_deposits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_deposits_insert_staff" ON public.garbage_deposits FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director'') OR has_role(auth.uid(),''teacher''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_deposits_delete_admin" ON public.garbage_deposits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_deposits_delete_admin" ON public.garbage_deposits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_deposits_delete_admin" ON public.garbage_deposits FOR DELETE TO authenticated
  USING (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- redemptions: เหมือน deposits
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_redemptions_select_staff" ON public.garbage_redemptions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_redemptions_select_staff" ON public.garbage_redemptions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_redemptions_select_staff" ON public.garbage_redemptions FOR SELECT TO authenticated
  USING (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director'') OR has_role(auth.uid(),''teacher''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_redemptions_select_student_self" ON public.garbage_redemptions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_redemptions_select_student_self" ON public.garbage_redemptions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_redemptions_select_student_self" ON public.garbage_redemptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.auth_user_id = auth.uid()))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_redemptions_insert_staff" ON public.garbage_redemptions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_redemptions_insert_staff" ON public.garbage_redemptions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_redemptions_insert_staff" ON public.garbage_redemptions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director'') OR has_role(auth.uid(),''teacher''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_redemptions_delete_admin" ON public.garbage_redemptions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_redemptions_delete_admin" ON public.garbage_redemptions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_redemptions_delete_admin" ON public.garbage_redemptions FOR DELETE TO authenticated
  USING (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- student_points: staff อ่านทั้งหมด, นักเรียนอ่านของตัวเอง
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_points_select_staff" ON public.garbage_student_points';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_points_select_staff" ON public.garbage_student_points';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_points_select_staff" ON public.garbage_student_points FOR SELECT TO authenticated
  USING (has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''director'') OR has_role(auth.uid(),''teacher''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_points_select_self" ON public.garbage_student_points';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "garbage_points_select_self" ON public.garbage_student_points';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "garbage_points_select_self" ON public.garbage_student_points FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.auth_user_id = auth.uid()))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- enable realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'garbage_deposits'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.garbage_deposits;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'garbage_redemptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.garbage_redemptions;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'garbage_student_points'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.garbage_student_points;
  END IF;
END $$;
