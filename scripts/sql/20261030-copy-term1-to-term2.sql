-- ============================================================================
-- (เลืือกใช้ ้) คััดลอกตารางสอน + ห้ องเรเรียนผuuูสั อน ภาคเรเรียนท่ี 1 → ภาคเรเรียนท่ี 2
-- ปีีการศึึกษา 2569 (ปีี ค.ศ. 2026)
-- ----------------------------------------------------------------------------
-- ใช้ ้ เฉพาะเมื่ อยั งไม่  ได้ ้ ใส่ ่ ตารางสอนภาคเรเรียนท่ี 2 เท่ า นั้ น
-- ถ้ าในภาคเรเรียนท่ี 2 มี ้ ตารางสอนอยู่ ่ แล้ ว สคริปตต์ ่ วั นจะข้ ามไป
--
-- หมายเหตตุ  trigger ของตาราง schedules จะสร้ าง "ห้ องเรเรียนผuuูสั อน"
-- (teacher_assignments) ให้ ้ อตั โนมั ติ ตามตารางสอนท่ี คััดลอกเข้ ามา
--
-- ถ้ าต้ องการย้ อนกลบั  (ลบท่ี  คััดลอกไป) ให้ ้ รั น:
--   DELETE FROM public.schedules          WHERE academic_year = 2026 AND semester = 2;
--   DELETE FROM public.teacher_assignments WHERE academic_year = 2026 AND semester = 2;
-- ============================================================================

-- 3.1) ตารางสอน (schedules) — คััดลอกเฉพาะเมื่ อยั งไม่  มี ้ แถวในเทอม 2
INSERT INTO public.schedules
       (classroom_id, subject_id, day_of_week, period, start_time, end_time,
        teacher_name, teacher_id, academic_year, semester, room,
        duration_periods, subject_name_raw, school_id)
SELECT s.classroom_id, s.subject_id, s.day_of_week, s.period, s.start_time, s.end_time,
       s.teacher_name, s.teacher_id, 2026, 2, s.room,
       s.duration_periods, s.subject_name_raw, s.school_id
  FROM public.schedules s
 WHERE s.academic_year = 2026
   AND s.semester = 1
   AND NOT EXISTS (
     SELECT 1 FROM public.schedules t
      WHERE t.academic_year = 2026 AND t.semester = 2
   );

-- 3.2) ห้ องเรเรียนผuuูสั อน (teacher_assignments) — สำรองไว้ ้
--      ปกติ  trigger จะสร้ างให้ ้ แล้ ว จึ งไม่  ซ้ำ
INSERT INTO public.teacher_assignments
       (personnel_id, subject_id, classroom_id, academic_year, semester)
SELECT a.personnel_id, a.subject_id, a.classroom_id, 2026, 2
  FROM public.teacher_assignments a
 WHERE a.academic_year = 2026
   AND a.semester = 1
   AND NOT EXISTS (
     SELECT 1 FROM public.teacher_assignments t
      WHERE t.academic_year = 2026 AND t.semester = 2
   )
ON CONFLICT (personnel_id, subject_id, classroom_id, academic_year, semester)
DO NOTHING;

-- ---------------------------------------------------------------------------
-- ตรวจผล
-- ---------------------------------------------------------------------------
-- SELECT academic_year, semester, count(*) FROM public.schedules
--  GROUP BY 1, 2 ORDER BY 1, 2;
-- SELECT academic_year, semester, count(*) FROM public.teacher_assignments
--  GROUP BY 1, 2 ORDER BY 1, 2;
