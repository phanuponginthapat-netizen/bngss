-- ============================================================================
-- เปลี่ยนวิชาเป็นเทอม 2/2569 ตามหลักสูตรสถานศึกษา 2569 (academic_year = ค.ศ. 2026)
--
-- * ม.1–3: ใช้คู่วิชาเทอม 1 -> เทอม 2 จากโครงสร้างหลักสูตร (45 คู่)
--   ถ้าระบบยังไม่มีวิชาเทอม 2 จะสร้างให้ โดยคัดลอกหน่วยกิต ชั่วโมง น้ำหนักคะแนน
--   และประเภทวิชาจากวิชาคู่ของเทอม 1
-- * ป.1–6 และกิจกรรม (แนะแนว ลูกเสือ ชุมนุม ฯลฯ): เป็นรายปี ใช้รหัสเดิมของเทอม 2
-- * ตารางสอนเทอม 2 = ตารางเทอม 1 ชั่วคราว (ครู ห้อง วัน คาบ เวลาเดิม)
--   จนกว่าจะนำเข้าตารางสอนเทอม 2 จริง
-- * ไม่แก้/ลบข้อมูลเทอม 1 ไม่ทำซ้ำถ้าเทอม 2 มีตารางแล้ว
-- * trigger จะสร้างรายการครูประจำวิชาเทอม 2 ให้อัตโนมัติ
-- ============================================================================

CREATE TEMP TABLE curriculum_pairs(code1 text, code2 text, name2 text) ON COMMIT DROP;
INSERT INTO curriculum_pairs VALUES
  ('ท21101','ท21102','ภาษาไทย 2'),
  ('ค21101','ค21102','คณิตศาสตร์ 2'),
  ('ว21101','ว21102','วิทยาศาสตร์ 2'),
  ('ว21103','ว21104','วิทยาการคำนวณ 1'),
  ('ส21101','ส21103','สังคมศึกษา ศาสนา และ วัฒนธรรม 2'),
  ('ส21102','ส21104','ประวัติศาสตร์ 2'),
  ('พ21101','พ21102','สุขศึกษาและพลศึกษา 2'),
  ('ศ21101','ศ21102','ศิลปะ 2'),
  ('ง21101','ง21102','การงานอาชีพ 2'),
  ('อ21101','อ21102','ภาษาอังกฤษพื้นฐาน 2'),
  ('ส21237','ส21238','ต้านทุจริต 2'),
  ('อ21201','อ21202','ภาษาอังกฤษเพื่อการสื่อสาร 2'),
  ('ว21203','ว21204','การเขียนโปรแกรมควบคุมหุ่นยนต์'),
  ('ง21201','ง21202','การปลูกผักไฮโดรโปนิกส์'),
  ('ศ21201','ศ21202','ดนตรี 2'),
  ('ท22101','ท22102','ภาษาไทย 4'),
  ('ค22101','ค22102','คณิตศาสตร์ 4'),
  ('ว22101','ว22102','วิทยาศาสตร์ 4'),
  ('ว22103','ว22104','วิทยาการคำนวณ 2'),
  ('ส22101','ส22103','สังคมศึกษา ศาสนา และ วัฒนธรรม 4'),
  ('ส22102','ส22104','ประวัติศาสตร์ 4'),
  ('พ22101','พ22102','สุขศึกษาและพลศึกษา 4'),
  ('ศ22101','ศ22102','ศิลปะ 4'),
  ('ง22101','ง22102','การงานอาชีพ 4'),
  ('อ22101','อ22102','ภาษาอังกฤษพื้นฐาน 4'),
  ('ส22239','ส22240','ต้านทุจริต 4'),
  ('อ22201','อ22202','ภาษาอังกฤษเพื่อการสื่อสาร 4'),
  ('ว22201','ว22202','เกมสร้างสรรค์ด้วยโปรแกรมคอมพิวเตอร์'),
  ('ว22203','ว22204','เชื้อเพลิงเพื่อการคมนาคม ขนส่ง 2'),
  ('ศ22203','ศ22204','ดนตรี 4'),
  ('ท23101','ท23102','ภาษาไทย 6'),
  ('ค23101','ค23102','คณิตศาสตร์ 6'),
  ('ว23101','ว23102','วิทยาศาสตร์ 6'),
  ('ว23103','ว23104','วิทยาการคำนวณ 3'),
  ('ส23101','ส23103','สังคมศึกษา ศาสนา และ วัฒนธรรม 6'),
  ('ส23102','ส23104','ประวัติศาสตร์ 6'),
  ('พ23101','พ23102','สุขศึกษาและพลศึกษา 6'),
  ('ศ23101','ศ23102','ศิลปะ 6'),
  ('ง23101','ง23102','การงานอาชีพ 6'),
  ('อ23101','อ23102','ภาษาอังกฤษพื้นฐาน 6'),
  ('ส23241','ส23242','ต้านทุจริต 6'),
  ('อ23201','อ23202','ภาษาอังกฤษเพื่อการสื่อสาร 6'),
  ('ว23201','ว23202','อินเทอร์เน็ตและการสร้างเว็บเพจ'),
  ('ว23203','ว23204','พลังงานไฟฟ้า 2'),
  ('ศ23205','ศ23206','ดนตรี 6');

-- 1) สร้างวิชาเทอม 2 ที่ยังไม่มีในระบบ
INSERT INTO public.subjects
       (code, name_th, name_en, credits, subject_type, grade_level, semester,
        academic_year, hours_per_week, school_id, weight_assignment,
        weight_midterm, weight_final, weight_attendance, weeks_per_semester)
SELECT DISTINCT ON (p.code2)
       p.code2, p.name2, NULL, s1.credits, s1.subject_type, s1.grade_level, 2,
       2026, s1.hours_per_week, s1.school_id, s1.weight_assignment,
       s1.weight_midterm, s1.weight_final, s1.weight_attendance, s1.weeks_per_semester
  FROM curriculum_pairs p
  JOIN public.subjects s1 ON s1.code = p.code1 AND s1.academic_year = 2026 AND s1.semester = 1
 WHERE NOT EXISTS (SELECT 1 FROM public.subjects x
                    WHERE x.code = p.code2 AND x.academic_year = 2026 AND x.semester = 2)
 ORDER BY p.code2;

-- 2) ตารางสอนเทอม 2 จากตารางเทอม 1 โดยเปลี่ยนเป็นวิชาเทอม 2
WITH map AS (
  SELECT s1.id AS sem1_id,
         (SELECT x.id FROM public.subjects x
           WHERE x.academic_year = 2026 AND x.semester = 2
             AND x.code = COALESCE((SELECT p.code2 FROM curriculum_pairs p WHERE p.code1 = s1.code), s1.code)
           ORDER BY (x.grade_level IS NOT DISTINCT FROM s1.grade_level) DESC
           LIMIT 1) AS sem2_id
    FROM public.subjects s1
   WHERE s1.academic_year = 2026 AND s1.semester = 1
)
INSERT INTO public.schedules
       (classroom_id, subject_id, day_of_week, period, start_time, end_time,
        teacher_name, teacher_id, academic_year, semester, room,
        duration_periods, subject_name_raw, school_id)
SELECT s.classroom_id, m.sem2_id, s.day_of_week, s.period, s.start_time, s.end_time,
       s.teacher_name, s.teacher_id, 2026, 2, s.room,
       s.duration_periods, sub2.name_th, s.school_id
  FROM public.schedules s
  JOIN map m ON m.sem1_id = s.subject_id AND m.sem2_id IS NOT NULL
  JOIN public.subjects sub2 ON sub2.id = m.sem2_id
 WHERE s.academic_year = 2026 AND s.semester = 1
   AND NOT EXISTS (SELECT 1 FROM public.schedules t
                    WHERE t.academic_year = 2026 AND t.semester = 2);

-- 3) ตรวจผล (ควรได้ 270 คาบ)
SELECT count(*) AS term2_periods, count(DISTINCT subject_id) AS term2_subjects
  FROM public.schedules WHERE academic_year = 2026 AND semester = 2;
SELECT count(*) AS term2_teacher_assignments
  FROM public.teacher_assignments WHERE academic_year = 2026 AND semester = 2;
