-- แก้ schema drift ของ student_scores (เกิด error 400 "column gpax/student_id does not exist")
ALTER TABLE public.student_scores
  ADD COLUMN IF NOT EXISTS student_id uuid,
  ADD COLUMN IF NOT EXISTS gpax numeric;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_student_scores_student_id') THEN
    ALTER TABLE public.student_scores
      ADD CONSTRAINT fk_student_scores_student_id
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_scores_student_id ON public.student_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_student_scores_student_code ON public.student_scores(student_code);

-- เชื่อมข้อมูลเดิม/ใหม่ให้ครบโดยไม่ต้องกรอกซ้ำ
UPDATE public.student_scores sc SET student_id = s.id
FROM public.students s WHERE sc.student_id IS NULL AND s.student_code = sc.student_code;

CREATE OR REPLACE FUNCTION public.sync_student_scores_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.student_id IS NULL AND NEW.student_code IS NOT NULL THEN
    SELECT id INTO NEW.student_id FROM students WHERE student_code = NEW.student_code LIMIT 1;
  END IF;
  IF NEW.student_id IS NOT NULL THEN
    IF COALESCE(btrim(NEW.student_code),'') = '' THEN
      SELECT student_code INTO NEW.student_code FROM students WHERE id = NEW.student_id;
    END IF;
    IF COALESCE(btrim(NEW.student_name),'') = '' THEN
      SELECT btrim(concat_ws(' ', COALESCE(prefix,''), first_name, last_name)) INTO NEW.student_name
      FROM students WHERE id = NEW.student_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_student_scores_links ON public.student_scores;
CREATE TRIGGER trg_student_scores_links BEFORE INSERT OR UPDATE ON public.student_scores
FOR EACH ROW EXECUTE FUNCTION public.sync_student_scores_links();
