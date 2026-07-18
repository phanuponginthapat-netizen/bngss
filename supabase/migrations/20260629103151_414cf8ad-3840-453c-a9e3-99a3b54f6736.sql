
-- 1) Points ledger
CREATE TABLE public.fitness_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fpl_user ON public.fitness_points_ledger(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_points_ledger TO authenticated;
GRANT ALL ON public.fitness_points_ledger TO service_role;
ALTER TABLE public.fitness_points_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user view own points" ON public.fitness_points_ledger FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'));
CREATE POLICY "admin manage points" ON public.fitness_points_ledger FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

-- 2) Achievements catalog
CREATE TABLE public.fitness_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  metric text NOT NULL,           -- 'total_kcal' | 'total_minutes' | 'streak_days' | 'total_logs'
  threshold integer NOT NULL,
  reward_points integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fitness_achievements TO authenticated;
GRANT ALL ON public.fitness_achievements TO service_role;
ALTER TABLE public.fitness_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view achievements" ON public.fitness_achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage achievements" ON public.fitness_achievements FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

-- 3) User achievements (unlocked)
CREATE TABLE public.fitness_user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES public.fitness_achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);
GRANT SELECT, INSERT ON public.fitness_user_achievements TO authenticated;
GRANT ALL ON public.fitness_user_achievements TO service_role;
ALTER TABLE public.fitness_user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user view own ach" ON public.fitness_user_achievements FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'));

-- 4) Rewards catalog
CREATE TABLE public.fitness_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  cost_points integer NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fitness_rewards TO authenticated;
GRANT ALL ON public.fitness_rewards TO service_role;
ALTER TABLE public.fitness_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view rewards" ON public.fitness_rewards FOR SELECT TO authenticated USING (is_active OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));
CREATE POLICY "admin manage rewards" ON public.fitness_rewards FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

-- 5) Redemptions
CREATE TABLE public.fitness_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.fitness_rewards(id) ON DELETE RESTRICT,
  cost_points integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending | delivered | cancelled
  note text,
  delivered_by uuid,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fr_user ON public.fitness_redemptions(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.fitness_redemptions TO authenticated;
GRANT ALL ON public.fitness_redemptions TO service_role;
ALTER TABLE public.fitness_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user view/create own redeem" ON public.fitness_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'));
CREATE POLICY "user create own redeem" ON public.fitness_redemptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin update redeem" ON public.fitness_redemptions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.fitness_points_ledger;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fitness_user_achievements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fitness_rewards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fitness_redemptions;

-- 6) Helper: points balance
CREATE OR REPLACE FUNCTION public.fitness_points_balance(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(points),0)::int FROM public.fitness_points_ledger WHERE user_id = _user_id;
$$;

-- 7) Trigger: award points on new exercise log + unlock achievements
CREATE OR REPLACE FUNCTION public.fitness_award_on_exercise()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pts int;
  total_kcal numeric;
  total_min int;
  total_logs int;
  ach record;
BEGIN
  pts := GREATEST(1, CEIL(COALESCE(NEW.kcal_burned,0)/10.0)::int + COALESCE(NEW.duration_min,0)/5);
  INSERT INTO public.fitness_points_ledger(user_id, points, reason, source_type, source_id)
  VALUES (NEW.user_id, pts, 'ออกกำลังกาย ' || NEW.duration_min || ' นาที', 'exercise_log', NEW.id);

  SELECT COALESCE(SUM(kcal_burned),0), COALESCE(SUM(duration_min),0), COUNT(*)
    INTO total_kcal, total_min, total_logs
    FROM public.fitness_exercise_logs WHERE user_id = NEW.user_id;

  FOR ach IN
    SELECT a.* FROM public.fitness_achievements a
    WHERE a.is_active
      AND NOT EXISTS (SELECT 1 FROM public.fitness_user_achievements ua
                      WHERE ua.user_id = NEW.user_id AND ua.achievement_id = a.id)
      AND (
        (a.metric = 'total_kcal' AND total_kcal >= a.threshold) OR
        (a.metric = 'total_minutes' AND total_min >= a.threshold) OR
        (a.metric = 'total_logs' AND total_logs >= a.threshold)
      )
  LOOP
    INSERT INTO public.fitness_user_achievements(user_id, achievement_id) VALUES (NEW.user_id, ach.id);
    IF ach.reward_points > 0 THEN
      INSERT INTO public.fitness_points_ledger(user_id, points, reason, source_type, source_id)
      VALUES (NEW.user_id, ach.reward_points, 'ปลดล็อก: ' || ach.name, 'achievement', ach.id);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_fitness_award_on_exercise
AFTER INSERT ON public.fitness_exercise_logs
FOR EACH ROW EXECUTE FUNCTION public.fitness_award_on_exercise();

-- 8) Trigger: redemption deducts points + stock
CREATE OR REPLACE FUNCTION public.fitness_handle_redemption()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  bal int;
BEGIN
  SELECT * INTO r FROM public.fitness_rewards WHERE id = NEW.reward_id FOR UPDATE;
  IF NOT FOUND OR NOT r.is_active THEN RAISE EXCEPTION 'รางวัลไม่พร้อมใช้งาน'; END IF;
  IF r.stock <= 0 THEN RAISE EXCEPTION 'รางวัลหมดสต็อก'; END IF;
  bal := public.fitness_points_balance(NEW.user_id);
  IF bal < r.cost_points THEN RAISE EXCEPTION 'แต้มไม่พอ (มี % ต้องใช้ %)', bal, r.cost_points; END IF;

  NEW.cost_points := r.cost_points;
  UPDATE public.fitness_rewards SET stock = stock - 1, updated_at = now() WHERE id = r.id;
  INSERT INTO public.fitness_points_ledger(user_id, points, reason, source_type, source_id)
  VALUES (NEW.user_id, -r.cost_points, 'แลกของ: ' || r.name, 'redemption', NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_fitness_handle_redemption
BEFORE INSERT ON public.fitness_redemptions
FOR EACH ROW EXECUTE FUNCTION public.fitness_handle_redemption();

-- 9) Seed default achievements
INSERT INTO public.fitness_achievements(code,name,description,icon,metric,threshold,reward_points) VALUES
('first_workout','ก้าวแรก','บันทึกออกกำลังกายครั้งแรก','🎉','total_logs',1,5),
('logs_10','สม่ำเสมอ','บันทึกออกกำลังกายครบ 10 ครั้ง','🔥','total_logs',10,20),
('logs_50','นักสู้','บันทึกออกกำลังกายครบ 50 ครั้ง','💪','total_logs',50,100),
('kcal_500','เผาผลาญ 500','เผาผลาญสะสมครบ 500 kcal','⚡','total_kcal',500,15),
('kcal_2000','เผาผลาญ 2,000','เผาผลาญสะสมครบ 2,000 kcal','🚀','total_kcal',2000,50),
('kcal_10000','เผาผลาญ 10,000','เผาผลาญสะสมครบ 10,000 kcal','🏆','total_kcal',10000,200),
('min_60','ครบ 1 ชั่วโมง','ออกกำลังกายสะสมครบ 60 นาที','⏱️','total_minutes',60,10),
('min_600','ครบ 10 ชั่วโมง','ออกกำลังกายสะสมครบ 600 นาที','⌛','total_minutes',600,60);
