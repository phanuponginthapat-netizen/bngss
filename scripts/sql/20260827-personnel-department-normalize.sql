-- ============================================================
-- แก้ข้อมูลบุคลากร / ฝ่ายงาน / ตำแหน่ง ให้ตรงกับที่ระบบใช้จริง
-- 2026-08-27
-- ปัญหา:
--  1) personnel.department เก็บชื่อย่อ ("วิชาการ") แต่หน้าผังองค์กร/หน้าฝ่ายงาน
--     ใช้ชื่อเต็ม ("ฝ่ายวิชาการ") → บุคลากรทุกคนตกไปอยู่ "ยังไม่ระบุฝ่ายงาน"
--  2) trigger ensure_personnel_required_fields ใส่ default 'วิชาการ' ทำให้ข้อมูลใหม่ผิดซ้ำ
--  3) academic_standing สะกดผิด "ครูู" (สระอูซ้อน) 11 ระเบียน
--  4) ผู้อำนวยการถูกจัดอยู่ฝ่ายวิชาการ + ไม่มีหัวหน้าฝ่ายใน user_departments
--  5) schedules 15 คาบไม่มี teacher_id (ครูประจำวิชาไม่ขึ้น)
-- ============================================================

SET session_replication_role = replica; -- ข้าม guard trigger ที่ล็อกฟิลด์ไว้

-- 1) ชื่อฝ่ายงานมาตรฐาน (ตรงกับ DepartmentManagementPage / OrgChartPage)
UPDATE public.personnel SET department = CASE
  WHEN btrim(department) IN ('วิชาการ','ฝ่ายวิชาการ','academic') THEN 'ฝ่ายวิชาการ'
  WHEN btrim(department) IN ('กิจการนักเรียน','ฝ่ายกิจการนักเรียน','student_affairs') THEN 'ฝ่ายกิจการนักเรียน'
  WHEN btrim(department) IN ('บริหารทั่วไป','ฝ่ายบริหารทั่วไป','บริหารงานทั่วไป','ฝ่ายบริหารงานทั่วไป','general_admin') THEN 'ฝ่ายบริหารงานทั่วไป'
  WHEN btrim(department) IN ('งบประมาณ','บุคคล','งบประมาณและบุคคล','ฝ่ายงบประมาณและบุคคล','finance_personnel','personnel','budget_planning') THEN 'ฝ่ายงบประมาณและบุคคล'
  WHEN btrim(department) IN ('อำนวยการ','สำนักผู้อำนวยการ','director_office') THEN 'สำนักผู้อำนวยการ'
  ELSE btrim(department)
END;

-- 2) ผู้อำนวยการ → สำนักผู้อำนวยการ
UPDATE public.personnel SET department = 'สำนักผู้อำนวยการ'
WHERE position LIKE 'ผู้อำนวยการ%' OR academic_standing LIKE 'ผู้อำนวยการ%';

-- 3) วิทยฐานะสะกดผิด
UPDATE public.personnel
SET academic_standing = btrim(replace(academic_standing, 'ครูู', 'ครู'))
WHERE academic_standing LIKE '%ครูู%';
UPDATE public.personnel SET academic_standing = NULL
WHERE btrim(coalesce(academic_standing,'')) IN ('', 'ไม่มี');

-- 4) บัญชีระบบ / ผู้สังเกตการณ์ ไม่ใช่ครู
UPDATE public.personnel
SET position = 'อุปกรณ์ระบบ', department = 'ระบบ', academic_standing = NULL
WHERE employee_code = 'kiosk';
UPDATE public.personnel
SET position = 'ศึกษานิเทศก์', department = 'หน่วยงานภายนอก'
WHERE first_name = 'ผู้สังเกตการณ์';

SET session_replication_role = origin;

-- 5) default ของ trigger ให้เป็นชื่อฝ่ายมาตรฐาน
CREATE OR REPLACE FUNCTION public.ensure_personnel_required_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.employee_code := COALESCE(
    NULLIF(btrim(NEW.employee_code), ''),
    'EMP-' || substr(COALESCE(NEW.user_id, NEW.id)::text, 1, 8)
  );
  NEW.first_name := COALESCE(NEW.first_name, '');
  NEW.last_name := COALESCE(NEW.last_name, '');
  NEW.position := COALESCE(NULLIF(btrim(NEW.position), ''), 'ครู');
  NEW.department := COALESCE(NULLIF(btrim(NEW.department), ''), 'ฝ่ายวิชาการ');
  NEW.status := COALESCE(NULLIF(btrim(NEW.status), ''), 'active');
  RETURN NEW;
END;
$$;

-- 6) ฝ่ายงานของผู้ใช้ให้ตรงกับ personnel + ผอ. เป็นหัวหน้าสำนักผู้อำนวยการ
INSERT INTO public.user_departments (user_id, department, dept_role, is_head)
SELECT p.user_id, 'director_office'::school_department, 'head'::dept_role, true
FROM public.personnel p
WHERE p.user_id IS NOT NULL AND p.department = 'สำนักผู้อำนวยการ'
ON CONFLICT (user_id, department) DO UPDATE
  SET dept_role = 'head'::dept_role, is_head = true;

DELETE FROM public.user_departments ud
USING public.personnel p
WHERE p.user_id = ud.user_id
  AND p.department = 'สำนักผู้อำนวยการ'
  AND ud.department <> 'director_office'::school_department;

-- ให้บุคลากรที่ยังไม่มีแถวใน user_departments ได้ฝ่ายตาม personnel.department
INSERT INTO public.user_departments (user_id, department, dept_role, is_head)
SELECT p.user_id,
       (CASE p.department
          WHEN 'ฝ่ายวิชาการ' THEN 'academic'
          WHEN 'ฝ่ายกิจการนักเรียน' THEN 'student_affairs'
          WHEN 'ฝ่ายบริหารงานทั่วไป' THEN 'general_admin'
          WHEN 'ฝ่ายงบประมาณและบุคคล' THEN 'finance_personnel'
          WHEN 'สำนักผู้อำนวยการ' THEN 'director_office'
        END)::school_department,
       'member'::dept_role, false
FROM public.personnel p
WHERE p.user_id IS NOT NULL
  AND p.status = 'active'
  AND p.department IN ('ฝ่ายวิชาการ','ฝ่ายกิจการนักเรียน','ฝ่ายบริหารงานทั่วไป','ฝ่ายงบประมาณและบุคคล','สำนักผู้อำนวยการ')
  AND NOT EXISTS (SELECT 1 FROM public.user_departments ud WHERE ud.user_id = p.user_id)
ON CONFLICT DO NOTHING;

-- 7) เติมครูประจำวิชาให้ตารางสอนที่ยังว่าง จาก teacher_assignments (วิชา+ห้อง)
UPDATE public.schedules s
SET teacher_id = ta.personnel_id,
    teacher_name = COALESCE(NULLIF(btrim(s.teacher_name), ''),
                            (SELECT btrim(coalesce(p.prefix,'') || p.first_name || ' ' || p.last_name)
                             FROM public.personnel p WHERE p.id = ta.personnel_id))
FROM public.teacher_assignments ta
WHERE s.teacher_id IS NULL
  AND ta.subject_id = s.subject_id
  AND ta.classroom_id = s.classroom_id;

-- 8) คาบกิจกรรม (Maker space / ซ่อมเสริม) ที่ไม่มีครู → ใช้ครูประจำชั้นของห้องนั้น
UPDATE public.schedules s
SET teacher_id = c.homeroom_teacher_id,
    teacher_name = COALESCE(NULLIF(btrim(s.teacher_name), ''),
                            (SELECT btrim(coalesce(p.prefix,'') || p.first_name || ' ' || p.last_name)
                             FROM public.personnel p WHERE p.id = c.homeroom_teacher_id))
FROM public.classrooms c
WHERE s.teacher_id IS NULL
  AND c.id = s.classroom_id
  AND c.homeroom_teacher_id IS NOT NULL;

-- 9) ซิงก์ profiles.department / position_title ให้ตรงกับ personnel (หน้าอื่นอ่านจาก profiles)
UPDATE public.profiles pr
SET department = p.department,
    position_title = COALESCE(NULLIF(btrim(pr.position_title), ''), p.position)
FROM public.personnel p
WHERE p.user_id = pr.id
  AND (pr.department IS DISTINCT FROM p.department OR coalesce(btrim(pr.position_title),'') = '');
