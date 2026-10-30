-- ============================================================================
-- สร้างตารางสอนเทอม 2/2569 จากตารางเทอม 1 โดยเปลี่ยนเป็นรายวิชาเทอม 2 ตามหลักสูตร
-- (academic_year เก็บเป็น ค.ศ. 2026)
--
-- กติกาจับคู่วิชา:
--   1) ถ้าหลักสูตรมีวิชา "เฉพาะเทอม 2" รหัสถัดไป (เช่น ว21101 -> ว21102,
--      ว21103 -> ว21104) ใช้วิชานั้น
--   2) ไม่เช่นนั้นใช้วิชารหัสเดียวกันที่หลักสูตรลงไว้ในเทอม 2
--   3) ถ้าไม่พบคู่วิชาเทอม 2 จะไม่คัดลอกคาบนั้น (ไม่ใช้วิชาเทอม 1 แทน)
-- ครู ห้อง วัน คาบ เวลา คัดลอกจากเทอม 1 แก้ไขภายหลังได้
-- ไม่ทำอะไรถ้าเทอม 2 มีตารางอยู่แล้ว และไม่ลบ/แก้ข้อมูลเทอม 1
-- trigger sync_teacher_assignment_from_schedule จะสร้างครูประจำวิชาให้อัตโนมัติ
-- ============================================================================

WITH map AS (
  SELECT s1.id AS sem1_id,
         COALESCE(
           (SELECT x.id FROM public.subjects x
             WHERE x.academic_year = 2026 AND x.semester = 2
               AND s1.code ~ '[0-9]$'
               AND x.code = left(s1.code, length(s1.code) - 1)
                            || ((right(s1.code, 1)::int + 1) % 10)
               AND NOT EXISTS (SELECT 1 FROM public.subjects y
                                WHERE y.academic_year = 2026 AND y.semester = 1
                                  AND y.code = x.code)
             LIMIT 1),
           (SELECT x.id FROM public.subjects x
             WHERE x.academic_year = 2026 AND x.semester = 2
               AND x.code = s1.code
               AND x.grade_level IS NOT DISTINCT FROM s1.grade_level
             LIMIT 1),
           (SELECT x.id FROM public.subjects x
             WHERE x.academic_year = 2026 AND x.semester = 2
               AND x.code = s1.code
             LIMIT 1)
         ) AS sem2_id
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

-- ตรวจผล
SELECT count(*) AS term2_periods,
       count(DISTINCT subject_id) AS term2_subjects
  FROM public.schedules WHERE academic_year = 2026 AND semester = 2;
SELECT count(*) AS term2_teacher_assignments
  FROM public.teacher_assignments WHERE academic_year = 2026 AND semester = 2;
