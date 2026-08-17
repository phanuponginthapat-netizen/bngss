
-- 1. เพิ่ม personnel_id และทำให้ student_id เป็น nullable
ALTER TABLE public.garbage_deposits ADD COLUMN IF NOT EXISTS personnel_id uuid REFERENCES public.personnel(id) ON DELETE CASCADE;
ALTER TABLE public.garbage_deposits ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.garbage_deposits ADD CONSTRAINT garbage_deposits_holder_check 
  CHECK ((student_id IS NOT NULL AND personnel_id IS NULL) OR (student_id IS NULL AND personnel_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_garbage_deposits_personnel ON public.garbage_deposits(personnel_id);

ALTER TABLE public.garbage_redemptions ADD COLUMN IF NOT EXISTS personnel_id uuid REFERENCES public.personnel(id) ON DELETE CASCADE;
ALTER TABLE public.garbage_redemptions ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE public.garbage_redemptions ADD CONSTRAINT garbage_redemptions_holder_check 
  CHECK ((student_id IS NOT NULL AND personnel_id IS NULL) OR (student_id IS NULL AND personnel_id IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_garbage_redemptions_personnel ON public.garbage_redemptions(personnel_id);

-- 2. เพิ่มตารางแต้มสำหรับบุคลากร (แยกชัดเจน เพราะ FK cascade ต่างกัน)
CREATE TABLE IF NOT EXISTS public.garbage_personnel_points (
  personnel_id uuid PRIMARY KEY REFERENCES public.personnel(id) ON DELETE CASCADE,
  total_points integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.garbage_personnel_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gpp_select_staff" ON public.garbage_personnel_points;
CREATE POLICY "gpp_select_staff" ON public.garbage_personnel_points FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'));
DROP POLICY IF EXISTS "gpp_select_self" ON public.garbage_personnel_points;
CREATE POLICY "gpp_select_self" ON public.garbage_personnel_points FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = garbage_personnel_points.personnel_id AND p.user_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.garbage_personnel_points;

-- 3. ปรับ trigger เพิ่มแต้มให้รองรับบุคลากร
CREATE OR REPLACE FUNCTION public.add_points_on_deposit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    INSERT INTO public.garbage_student_points (student_id, total_points, updated_at)
    VALUES (NEW.student_id, NEW.points_earned, now())
    ON CONFLICT (student_id) DO UPDATE
      SET total_points = public.garbage_student_points.total_points + NEW.points_earned,
          updated_at = now();
  ELSIF NEW.personnel_id IS NOT NULL THEN
    INSERT INTO public.garbage_personnel_points (personnel_id, total_points, updated_at)
    VALUES (NEW.personnel_id, NEW.points_earned, now())
    ON CONFLICT (personnel_id) DO UPDATE
      SET total_points = public.garbage_personnel_points.total_points + NEW.points_earned,
          updated_at = now();
  END IF;
  RETURN NEW;
END $function$;

-- 4. ปรับ trigger ตัดแต้ม/สต๊อกให้รองรับบุคลากร
CREATE OR REPLACE FUNCTION public.process_redemption()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  current_points INT;
  current_stock INT;
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    SELECT total_points INTO current_points FROM public.garbage_student_points WHERE student_id = NEW.student_id;
  ELSE
    SELECT total_points INTO current_points FROM public.garbage_personnel_points WHERE personnel_id = NEW.personnel_id;
  END IF;
  IF current_points IS NULL THEN current_points := 0; END IF;
  IF current_points < NEW.points_used THEN
    RAISE EXCEPTION 'แต้มไม่เพียงพอ (มี % แต้ม ต้องใช้ % แต้ม)', current_points, NEW.points_used;
  END IF;

  SELECT stock INTO current_stock FROM public.garbage_rewards WHERE id = NEW.reward_id FOR UPDATE;
  IF current_stock IS NULL OR current_stock < NEW.quantity THEN
    RAISE EXCEPTION 'สต๊อกไม่เพียงพอ (เหลือ % ชิ้น)', COALESCE(current_stock, 0);
  END IF;

  UPDATE public.garbage_rewards SET stock = stock - NEW.quantity, updated_at = now() WHERE id = NEW.reward_id;

  IF NEW.student_id IS NOT NULL THEN
    UPDATE public.garbage_student_points
      SET total_points = total_points - NEW.points_used, updated_at = now()
      WHERE student_id = NEW.student_id;
  ELSE
    UPDATE public.garbage_personnel_points
      SET total_points = total_points - NEW.points_used, updated_at = now()
      WHERE personnel_id = NEW.personnel_id;
  END IF;

  RETURN NEW;
END $function$;

-- 5. RLS เพิ่มเติม: ให้บุคลากรเห็นรายการของตัวเอง
DROP POLICY IF EXISTS "garbage_deposits_select_personnel_self" ON public.garbage_deposits;
CREATE POLICY "garbage_deposits_select_personnel_self" ON public.garbage_deposits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = garbage_deposits.personnel_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "garbage_redemptions_select_personnel_self" ON public.garbage_redemptions;
CREATE POLICY "garbage_redemptions_select_personnel_self" ON public.garbage_redemptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = garbage_redemptions.personnel_id AND p.user_id = auth.uid()));
