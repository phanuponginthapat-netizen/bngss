
-- ============ food_catalog ============
CREATE TABLE public.food_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  kcal_per_serving NUMERIC(7,2) NOT NULL,
  serving_label TEXT DEFAULT 'จาน',
  protein_g NUMERIC(6,2),
  carb_g NUMERIC(6,2),
  fat_g NUMERIC(6,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.food_catalog TO authenticated, anon;
GRANT ALL ON public.food_catalog TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.food_catalog TO authenticated;
ALTER TABLE public.food_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read food catalog" ON public.food_catalog FOR SELECT USING (true);
CREATE POLICY "admins manage food catalog" ON public.food_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

-- ============ exercise_catalog ============
CREATE TABLE public.exercise_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'cardio',
  met NUMERIC(5,2) NOT NULL,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.exercise_catalog TO authenticated, anon;
GRANT ALL ON public.exercise_catalog TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.exercise_catalog TO authenticated;
ALTER TABLE public.exercise_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read exercise catalog" ON public.exercise_catalog FOR SELECT USING (true);
CREATE POLICY "admins manage exercise catalog" ON public.exercise_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

-- ============ fitness_profiles ============
CREATE TABLE public.fitness_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,2),
  birth_date DATE,
  sex TEXT CHECK (sex IN ('male','female','other')),
  activity_level TEXT NOT NULL DEFAULT 'moderate',
  goal TEXT NOT NULL DEFAULT 'maintain',
  target_weight_kg NUMERIC(5,2),
  daily_kcal_target INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_profiles TO authenticated;
GRANT ALL ON public.fitness_profiles TO service_role;
ALTER TABLE public.fitness_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own fitness profile" ON public.fitness_profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff view fitness profiles" ON public.fitness_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

-- ============ fitness_food_logs ============
CREATE TABLE public.fitness_food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date,
  meal_type TEXT NOT NULL DEFAULT 'snack',
  food_id UUID REFERENCES public.food_catalog(id) ON DELETE SET NULL,
  custom_name TEXT,
  portion NUMERIC(5,2) NOT NULL DEFAULT 1,
  kcal NUMERIC(7,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_food_logs_user_date ON public.fitness_food_logs(user_id, log_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_food_logs TO authenticated;
GRANT ALL ON public.fitness_food_logs TO service_role;
ALTER TABLE public.fitness_food_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own food logs" ON public.fitness_food_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff view food logs" ON public.fitness_food_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

-- ============ fitness_exercise_logs ============
CREATE TABLE public.fitness_exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bangkok')::date,
  exercise_id UUID REFERENCES public.exercise_catalog(id) ON DELETE SET NULL,
  custom_name TEXT,
  duration_min INTEGER NOT NULL,
  kcal_burned NUMERIC(7,2) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ex_logs_user_date ON public.fitness_exercise_logs(user_id, log_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_exercise_logs TO authenticated;
GRANT ALL ON public.fitness_exercise_logs TO service_role;
ALTER TABLE public.fitness_exercise_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user manages own exercise logs" ON public.fitness_exercise_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "staff view exercise logs" ON public.fitness_exercise_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

-- updated_at trigger
CREATE TRIGGER trg_fitness_profile_uat BEFORE UPDATE ON public.fitness_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_food_catalog_uat BEFORE UPDATE ON public.food_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_exercise_catalog_uat BEFORE UPDATE ON public.exercise_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- realtime
ALTER TABLE public.fitness_food_logs REPLICA IDENTITY FULL;
ALTER TABLE public.fitness_exercise_logs REPLICA IDENTITY FULL;
ALTER TABLE public.fitness_profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fitness_food_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fitness_exercise_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fitness_profiles;

-- ============ Seed food_catalog ============
INSERT INTO public.food_catalog (name, category, kcal_per_serving, serving_label) VALUES
('ข้าวผัดกะเพราหมูไข่ดาว','rice',650,'จาน'),
('ข้าวผัดกะเพราไก่ไข่ดาว','rice',600,'จาน'),
('ข้าวมันไก่','rice',585,'จาน'),
('ข้าวหมูแดง','rice',520,'จาน'),
('ข้าวหมูกรอบ','rice',650,'จาน'),
('ข้าวไข่เจียว','rice',480,'จาน'),
('ข้าวขาเหลือนพะโล้','rice',560,'จาน'),
('ข้าวคลุกกะปิ','rice',520,'จาน'),
('ข้าวเปล่า','rice',240,'จาน'),
('ส้มตำไทย','noodle',180,'จาน'),
('ส้มตำปูปลาร้า','noodle',220,'จาน'),
('ก๋วยเตี๋ยวน้ำใสหมู','noodle',350,'ชาม'),
('ก๋วยเตี๋ยวต้มยำ','noodle',400,'ชาม'),
('ก๋วยเตี๋ยวเรือ','noodle',450,'ชาม'),
('ผัดไทยกุ้งสด','noodle',520,'จาน'),
('ผัดซีอิ๊ว','noodle',570,'จาน'),
('ราดหน้า','noodle',520,'จาน'),
('สปาเก็ตตี้คาโบนาร่า','noodle',650,'จาน'),
('มาม่าต้มยำ','noodle',380,'ชาม'),
('ข้าวซอยไก่','noodle',590,'ชาม'),
('ลูกชิ้นทอด','snack',60,'ลูก'),
('ลูกชิ้นปิ้ง','snack',45,'ไม้'),
('ไส้กรอกปิ้ง','snack',90,'ไม้'),
('ไก่ทอด','snack',280,'ชิ้น'),
('ไก่ย่าง','snack',220,'ชิ้น'),
('หมูปิ้ง','snack',70,'ไม้'),
('ปอเปี๊ยะทอด','snack',110,'ชิ้น'),
('เกี๊ยวทอด','snack',85,'ชิ้น'),
('เฟรนช์ฟราย','snack',365,'ถ้วย'),
('โดนัท','snack',250,'ชิ้น'),
('แซนวิชแฮมชีส','snack',300,'ชิ้น'),
('เบอร์เกอร์','snack',520,'ชิ้น'),
('พิซซ่าชีส','snack',285,'ชิ้น'),
('นมจืดกล่อง','drink',120,'กล่อง 200ml'),
('นมหวานกล่อง','drink',160,'กล่อง 200ml'),
('นมช็อกโกแลต','drink',180,'กล่อง 200ml'),
('โอวัลตินเย็น','drink',220,'แก้ว'),
('ชาเย็น','drink',280,'แก้ว'),
('ชานมไข่มุก','drink',420,'แก้ว'),
('กาแฟเย็น','drink',230,'แก้ว'),
('น้ำหวานสีแดง','drink',150,'แก้ว'),
('น้ำอัดลม','drink',150,'กระป๋อง 325ml'),
('น้ำส้ม','drink',110,'แก้ว'),
('น้ำเปล่า','drink',0,'แก้ว'),
('น้ำมะนาวโซดา','drink',90,'แก้ว'),
('สมูทตี้ผลไม้','drink',200,'แก้ว'),
('กล้วยน้ำว้า','fruit',90,'ผล'),
('แอปเปิ้ล','fruit',80,'ผล'),
('ส้ม','fruit',60,'ผล'),
('แตงโม','fruit',50,'ชิ้น'),
('มะม่วงสุก','fruit',150,'ผล'),
('สับปะรด','fruit',80,'ชิ้น'),
('ขนมเค้กช็อกโกแลต','dessert',370,'ชิ้น'),
('ขนมปังสังขยา','dessert',280,'ชิ้น'),
('ไอศกรีมโคน','dessert',220,'แท่ง'),
('บัวลอย','dessert',280,'ถ้วย'),
('ข้าวเหนียวมะม่วง','dessert',420,'จาน'),
('ขนมครก','dessert',180,'ชุด'),
('โรตีกล้วยนม','dessert',430,'ชิ้น'),
('คุกกี้','dessert',150,'ชิ้น'),
('โยเกิร์ตผลไม้','dessert',150,'ถ้วย'),
('แกงเขียวหวานไก่','rice',280,'ถ้วย'),
('ต้มยำกุ้ง','rice',180,'ถ้วย'),
('ผัดผักรวม','rice',150,'จาน'),
('ไข่ต้ม','snack',75,'ฟอง'),
('ไข่ดาว','snack',95,'ฟอง');

-- ============ Seed exercise_catalog ============
INSERT INTO public.exercise_catalog (name, category, met, icon) VALUES
('เดิน (ปกติ)','daily',3.5,'walk'),
('เดินเร็ว','cardio',4.5,'walk'),
('วิ่งเหยาะๆ (8 กม./ชม.)','cardio',7.0,'run'),
('วิ่งเร็ว (12 กม./ชม.)','cardio',11.5,'run'),
('ปั่นจักรยานทั่วไป','cardio',6.0,'bike'),
('ปั่นจักรยานเร็ว','cardio',10.0,'bike'),
('ว่ายน้ำ','cardio',8.0,'swim'),
('กระโดดเชือก','cardio',10.0,'jump'),
('เต้นแอโรบิก','cardio',7.0,'dance'),
('โยคะ','daily',3.0,'yoga'),
('เตะฟุตบอล','sport',7.0,'soccer'),
('บาสเก็ตบอล','sport',6.5,'basketball'),
('แบดมินตัน','sport',5.5,'badminton'),
('วอลเลย์บอล','sport',4.0,'volleyball'),
('ปิงปอง','sport',4.0,'ping'),
('เทนนิส','sport',7.0,'tennis'),
('เซปักตะกร้อ','sport',6.0,'kick'),
('เวทเทรนนิ่ง','sport',5.0,'weight'),
('วิดพื้น/ซิทอัพ','sport',6.0,'pushup'),
('ขึ้นบันได','daily',8.0,'stairs'),
('ทำความสะอาดบ้าน','daily',3.5,'broom'),
('เดินเล่นกับสุนัข','daily',3.0,'dog');
