-- ลบ row พ.ศ. ที่ซ้ำกับ ค.ศ. ก่อน
DELETE FROM public.enrollments e
WHERE e.academic_year = 2569
  AND EXISTS (
    SELECT 1 FROM public.enrollments e2
    WHERE e2.student_id = e.student_id
      AND e2.subject_id = e.subject_id
      AND e2.semester = e.semester
      AND e2.academic_year = 2026
  );

-- แปลง row พ.ศ. ที่เหลือเป็น ค.ศ.
UPDATE public.enrollments SET academic_year = academic_year - 543 WHERE academic_year > 2400;