
-- Unified achievement scanner: checks all metrics, awards points, adds to portfolio
CREATE OR REPLACE FUNCTION public.fitness_check_achievements(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_kcal numeric; total_min int; total_logs int;
  food_logs int; ex_variety int;
  ach record; meets boolean;
BEGIN
  SELECT COALESCE(SUM(kcal_burned),0), COALESCE(SUM(duration_min),0), COUNT(*), COUNT(DISTINCT exercise_id)
    INTO total_kcal, total_min, total_logs, ex_variety
    FROM public.fitness_exercise_logs WHERE user_id = _user_id;
  SELECT COUNT(*) INTO food_logs FROM public.fitness_food_logs WHERE user_id = _user_id;

  FOR ach IN
    SELECT a.* FROM public.fitness_achievements a
    WHERE a.is_active
      AND NOT EXISTS (SELECT 1 FROM public.fitness_user_achievements ua
                      WHERE ua.user_id = _user_id AND ua.achievement_id = a.id)
  LOOP
    meets := CASE ach.metric
      WHEN 'total_kcal' THEN total_kcal >= ach.threshold
      WHEN 'total_minutes' THEN total_min >= ach.threshold
      WHEN 'total_logs' THEN total_logs >= ach.threshold
      WHEN 'food_logs' THEN food_logs >= ach.threshold
      WHEN 'exercise_variety' THEN ex_variety >= ach.threshold
      ELSE false
    END;
    IF meets THEN
      INSERT INTO public.fitness_user_achievements(user_id, achievement_id) VALUES (_user_id, ach.id)
      ON CONFLICT DO NOTHING;
      IF ach.reward_points > 0 THEN
        INSERT INTO public.fitness_points_ledger(user_id, points, reason, source_type, source_id)
        VALUES (_user_id, ach.reward_points, 'ปลดล็อก: ' || ach.name, 'achievement', ach.id);
      END IF;
      -- Auto-add badge to portfolio
      INSERT INTO public.portfolio_items(user_id, title, description, category, media_type, media_url, visibility, sort_order)
      VALUES (
        _user_id,
        '🏆 ' || ach.name,
        COALESCE(ach.description,'') || E'\n(เหรียญฟิตเนส +' || ach.reward_points || ' แต้ม)',
        'achievement_badge',
        'link',
        '#fitness-achievement:' || ach.code,
        'school',
        9999
      );
    END IF;
  END LOOP;
END $$;

-- Replace exercise trigger to use unified scanner
CREATE OR REPLACE FUNCTION public.fitness_award_on_exercise()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pts int;
BEGIN
  pts := GREATEST(1, CEIL(COALESCE(NEW.kcal_burned,0)/10.0)::int + COALESCE(NEW.duration_min,0)/5);
  INSERT INTO public.fitness_points_ledger(user_id, points, reason, source_type, source_id)
  VALUES (NEW.user_id, pts, 'ออกกำลังกาย ' || NEW.duration_min || ' นาที', 'exercise_log', NEW.id);
  PERFORM public.fitness_check_achievements(NEW.user_id);
  RETURN NEW;
END $$;

-- New trigger on food logs (no points, just achievement check)
CREATE OR REPLACE FUNCTION public.fitness_check_on_food()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.fitness_check_achievements(NEW.user_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fitness_check_on_food ON public.fitness_food_logs;
CREATE TRIGGER trg_fitness_check_on_food
AFTER INSERT ON public.fitness_food_logs
FOR EACH ROW EXECUTE FUNCTION public.fitness_check_on_food();

-- Seed more achievements (skip codes already present)
INSERT INTO public.fitness_achievements(code,name,description,icon,metric,threshold,reward_points) VALUES
-- exercise count
('logs_25','สู้ไม่ถอย','บันทึกออกกำลังกาย 25 ครั้ง','🔥','total_logs',25,40),
('logs_100','ตำนาน','บันทึกออกกำลังกาย 100 ครั้ง','👑','total_logs',100,250),
('logs_250','ราชาสุขภาพ','บันทึกออกกำลังกาย 250 ครั้ง','🦾','total_logs',250,600),
-- kcal
('kcal_100','สตาร์ทเครื่อง','เผาผลาญ 100 kcal','✨','total_kcal',100,5),
('kcal_1000','พลังไฟ','เผาผลาญสะสม 1,000 kcal','🌟','total_kcal',1000,30),
('kcal_5000','ลูกไฟ','เผาผลาญสะสม 5,000 kcal','☄️','total_kcal',5000,120),
('kcal_25000','อินเฟอร์โน่','เผาผลาญสะสม 25,000 kcal','🌋','total_kcal',25000,500),
('kcal_50000','เทพแห่งไฟ','เผาผลาญสะสม 50,000 kcal','🔱','total_kcal',50000,1000),
-- minutes
('min_30','30 นาทีแรก','ออกกำลังกายสะสม 30 นาที','⏰','total_minutes',30,5),
('min_180','3 ชั่วโมง','ออกกำลังกายสะสม 180 นาที','🕒','total_minutes',180,25),
('min_1200','20 ชั่วโมง','ออกกำลังกายสะสม 1,200 นาที','⏳','total_minutes',1200,120),
('min_3000','50 ชั่วโมง','ออกกำลังกายสะสม 3,000 นาที','🗿','total_minutes',3000,300),
('min_6000','100 ชั่วโมง','ออกกำลังกายสะสม 6,000 นาที','🎖️','total_minutes',6000,700),
-- food logs
('food_first','มื้อแรก','บันทึกมื้ออาหารครั้งแรก','🍽️','food_logs',1,5),
('food_10','สายกิน','บันทึกอาหาร 10 มื้อ','🥗','food_logs',10,15),
('food_50','นักโภชนาการ','บันทึกอาหาร 50 มื้อ','🥦','food_logs',50,60),
('food_100','โภชนาการเซียน','บันทึกอาหาร 100 มื้อ','🍱','food_logs',100,150),
('food_250','มาสเตอร์เชฟ','บันทึกอาหาร 250 มื้อ','👨‍🍳','food_logs',250,400),
('food_500','สายเฮลตี้ตลอดกาล','บันทึกอาหาร 500 มื้อ','🌿','food_logs',500,800),
-- variety
('variety_3','ลองของใหม่','ลองออกกำลังกาย 3 ท่าต่างกัน','🎨','exercise_variety',3,10),
('variety_5','นักลอง','ลองออกกำลังกาย 5 ท่าต่างกัน','🎯','exercise_variety',5,25),
('variety_10','ครบเครื่อง','ลองออกกำลังกาย 10 ท่าต่างกัน','🌈','exercise_variety',10,75),
('variety_20','ออลราวเดอร์','ลองออกกำลังกาย 20 ท่าต่างกัน','🤸','exercise_variety',20,200)
ON CONFLICT (code) DO NOTHING;

-- Backfill: scan all existing users so old logs count
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.fitness_exercise_logs
            UNION SELECT DISTINCT user_id FROM public.fitness_food_logs LOOP
    PERFORM public.fitness_check_achievements(r.user_id);
  END LOOP;
END $$;
