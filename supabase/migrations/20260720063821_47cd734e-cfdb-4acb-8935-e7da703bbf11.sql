-- 1) เพิ่ม Foreign Key ให้ padlet_boards เพื่อให้ PostgREST embed subjects/classrooms ได้
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.padlet_boards DROP CONSTRAINT IF EXISTS padlet_boards_subject_id_fkey';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.padlet_boards
  ADD CONSTRAINT padlet_boards_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.padlet_boards DROP CONSTRAINT IF EXISTS padlet_boards_classroom_id_fkey';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.padlet_boards
  ADD CONSTRAINT padlet_boards_classroom_id_fkey
  FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
NOTIFY pgrst, 'reload schema';
-- 2) Seed user_departments จาก personnel (map ข้อความไทย -> enum)
INSERT INTO public.user_departments (user_id, department, dept_role)
SELECT DISTINCT p.user_id,
  (CASE
     WHEN p.department IN ('วิชาการ','ฝ่ายวิชาการ') THEN 'academic'
     WHEN p.department IN ('กิจการนักเรียน','ฝ่ายกิจการนักเรียน') THEN 'student_affairs'
     WHEN p.department IN ('บริหารทั่วไป','บริหารงานทั่วไป','ฝ่ายบริหารงานทั่วไป') THEN 'general_admin'
     WHEN p.department IN ('งบประมาณและบุคคล','งบประมาณ','บุคคล','ฝ่ายงบประมาณและบุคคล') THEN 'finance_personnel'
     WHEN p.department IN ('สำนักผู้อำนวยการ','บริหาร','ผู้อำนวยการ') THEN 'director_office'
     ELSE NULL
   END)::school_department,
  'member'::dept_role
FROM public.personnel p
WHERE p.user_id IS NOT NULL
  AND p.department IS NOT NULL
  AND (CASE
         WHEN p.department IN ('วิชาการ','ฝ่ายวิชาการ') THEN 'academic'
         WHEN p.department IN ('กิจการนักเรียน','ฝ่ายกิจการนักเรียน') THEN 'student_affairs'
         WHEN p.department IN ('บริหารทั่วไป','บริหารงานทั่วไป','ฝ่ายบริหารงานทั่วไป') THEN 'general_admin'
         WHEN p.department IN ('งบประมาณและบุคคล','งบประมาณ','บุคคล','ฝ่ายงบประมาณและบุคคล') THEN 'finance_personnel'
         WHEN p.department IN ('สำนักผู้อำนวยการ','บริหาร','ผู้อำนวยการ') THEN 'director_office'
         ELSE NULL
       END) IS NOT NULL
ON CONFLICT (user_id, department) DO NOTHING;
-- 3) Seed user_subject_groups จาก personnel.subject_group
INSERT INTO public.user_subject_groups (user_id, subject_group, group_role)
SELECT DISTINCT p.user_id, p.subject_group, 'member'::dept_role
FROM public.personnel p
WHERE p.user_id IS NOT NULL
  AND p.subject_group IS NOT NULL
  AND btrim(p.subject_group) <> ''
ON CONFLICT (user_id, subject_group) DO NOTHING;
