-- แยกผลการเรียน (student_scores) ตามภาคเรียน/ปีการศึกษา
-- เดิม: 1 นักเรียน + 1 วิชา = 1 แถว → นำเข้าเทอมใหม่จะทับเทอมเก่า
-- รันใน SQL editor ของ backend โรงเรียน (ปลอดภัย รันซ้ำได้)

BEGIN;

-- 1) ลบเงื่อนไขไม่ซ้ำแบบเดิม (student_code, subject_id)
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.student_scores'::regclass
      AND con.contype = 'u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
           FROM unnest(con.conkey) k JOIN pg_attribute a
             ON a.attrelid = con.conrelid AND a.attnum = k)
          = ARRAY['student_code','subject_id']
  LOOP
    EXECUTE format('ALTER TABLE public.student_scores DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- 1.5) ปีการศึกษาเก็บเป็น ค.ศ. — แปลงแถวที่บันทึกเป็น พ.ศ. (>2400)
--      ถ้ามีแถว ค.ศ. ของเทอมเดียวกันอยู่แล้ว เก็บแถวที่อัปเดตล่าสุดไว้
DELETE FROM public.student_scores b
USING public.student_scores c
WHERE b.academic_year > 2400
  AND c.academic_year = b.academic_year - 543
  AND c.student_code = b.student_code AND c.subject_id = b.subject_id
  AND c.semester IS NOT DISTINCT FROM b.semester
  AND COALESCE(c.updated_at, c.created_at) >= COALESCE(b.updated_at, b.created_at);
DELETE FROM public.student_scores c
USING public.student_scores b
WHERE b.academic_year > 2400
  AND c.academic_year = b.academic_year - 543
  AND c.student_code = b.student_code AND c.subject_id = b.subject_id
  AND c.semester IS NOT DISTINCT FROM b.semester;
UPDATE public.student_scores SET academic_year = academic_year - 543 WHERE academic_year > 2400;

-- 2) เงื่อนไขใหม่: แยกตามภาคเรียนและปีการศึกษา
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'student_scores_code_subject_term_key') THEN
    ALTER TABLE public.student_scores
      ADD CONSTRAINT student_scores_code_subject_term_key
      UNIQUE (student_code, subject_id, semester, academic_year);
  END IF;
END $$;

-- 3) คะแนนรวม: ถ้าไม่มีคะแนนย่อยเลย ให้คงคะแนนรวมที่ส่งมา (ยึดคะแนนจากไฟล์ ปพ.)
CREATE OR REPLACE FUNCTION public.auto_compute_total_score()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.assignment_score IS NULL AND NEW.midterm_score IS NULL AND NEW.final_score IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.total_score := COALESCE(NEW.assignment_score,0) + COALESCE(NEW.midterm_score,0) + COALESCE(NEW.final_score,0);
  RETURN NEW;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
