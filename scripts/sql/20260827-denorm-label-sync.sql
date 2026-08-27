-- เติมชื่อ (denormalized label) อัตโนมัติจากข้อมูลต้นทาง เพื่อไม่ต้องกรอกซ้ำ
CREATE OR REPLACE FUNCTION public.sync_denorm_labels()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  spec text;
  parts text[];
  idcol text; namecol text; master text;
  idval uuid; oldid uuid; curname text; newname text;
BEGIN
  FOREACH spec IN ARRAY TG_ARGV LOOP
    parts := string_to_array(spec, '|');
    idcol := parts[1]; namecol := parts[2]; master := parts[3];

    EXECUTE format('SELECT ($1).%I', idcol) INTO idval USING NEW;
    EXECUTE format('SELECT ($1).%I', namecol) INTO curname USING NEW;
    oldid := NULL;
    IF TG_OP = 'UPDATE' THEN
      EXECUTE format('SELECT ($1).%I', idcol) INTO oldid USING OLD;
    END IF;

    IF idval IS NULL THEN CONTINUE; END IF;
    IF curname IS NOT NULL AND btrim(curname) <> '' AND (TG_OP = 'INSERT' OR idval IS NOT DISTINCT FROM oldid) THEN
      CONTINUE;
    END IF;

    newname := NULL;
    CASE master
      WHEN 'subjects'   THEN SELECT COALESCE(name_th, code) INTO newname FROM subjects WHERE id = idval;
      WHEN 'classrooms' THEN SELECT name INTO newname FROM classrooms WHERE id = idval;
      WHEN 'personnel'  THEN SELECT btrim(concat_ws(' ', COALESCE(prefix,''), first_name, last_name)) INTO newname FROM personnel WHERE id = idval;
      WHEN 'students'   THEN SELECT btrim(concat_ws(' ', COALESCE(prefix,''), first_name, last_name)) INTO newname FROM students WHERE id = idval;
      WHEN 'profiles'   THEN SELECT btrim(concat_ws(' ', first_name, last_name)) INTO newname FROM profiles WHERE id = idval;
      ELSE newname := NULL;
    END CASE;

    IF newname IS NOT NULL AND btrim(newname) <> '' THEN
      NEW := jsonb_populate_record(NEW, jsonb_build_object(namecol, newname));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_labels ON public.schedules;
CREATE TRIGGER trg_labels BEFORE INSERT OR UPDATE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.sync_denorm_labels('teacher_id|teacher_name|personnel');

DROP TRIGGER IF EXISTS trg_labels ON public.learning_center_bookings;
CREATE TRIGGER trg_labels BEFORE INSERT OR UPDATE ON public.learning_center_bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_denorm_labels(
  'teacher_id|teacher_name|personnel','subject_id|subject_name|subjects','classroom_id|classroom_name|classrooms');

DROP TRIGGER IF EXISTS trg_labels ON public.pp5_files;
CREATE TRIGGER trg_labels BEFORE INSERT OR UPDATE ON public.pp5_files
FOR EACH ROW EXECUTE FUNCTION public.sync_denorm_labels(
  'personnel_id|teacher_name|personnel','subject_id|subject_name|subjects');

DROP TRIGGER IF EXISTS trg_labels ON public.pp6_files;
CREATE TRIGGER trg_labels BEFORE INSERT OR UPDATE ON public.pp6_files
FOR EACH ROW EXECUTE FUNCTION public.sync_denorm_labels(
  'personnel_id|teacher_name|personnel','classroom_id|classroom_name|classrooms');

DROP TRIGGER IF EXISTS trg_labels ON public.ict_loans;
CREATE TRIGGER trg_labels BEFORE INSERT OR UPDATE ON public.ict_loans
FOR EACH ROW EXECUTE FUNCTION public.sync_denorm_labels('subject_id|subject_name|subjects');

DROP TRIGGER IF EXISTS trg_labels ON public.question_bank;
CREATE TRIGGER trg_labels BEFORE INSERT OR UPDATE ON public.question_bank
FOR EACH ROW EXECUTE FUNCTION public.sync_denorm_labels('subject_id|subject_name|subjects');

DROP TRIGGER IF EXISTS trg_labels ON public.student_enrollment_history;
CREATE TRIGGER trg_labels BEFORE INSERT OR UPDATE ON public.student_enrollment_history
FOR EACH ROW EXECUTE FUNCTION public.sync_denorm_labels('classroom_id|classroom_name|classrooms');

DROP TRIGGER IF EXISTS trg_labels ON public.worksheet_submissions;
CREATE TRIGGER trg_labels BEFORE INSERT OR UPDATE ON public.worksheet_submissions
FOR EACH ROW EXECUTE FUNCTION public.sync_denorm_labels('student_id|student_name|profiles');

-- backfill ข้อมูลเดิมที่ยังว่าง
UPDATE public.schedules s SET teacher_name = btrim(concat_ws(' ', COALESCE(p.prefix,''), p.first_name, p.last_name))
FROM public.personnel p WHERE p.id = s.teacher_id AND COALESCE(btrim(s.teacher_name),'') = '';

UPDATE public.learning_center_bookings b SET subject_name = COALESCE(sj.name_th, sj.code)
FROM public.subjects sj WHERE sj.id = b.subject_id AND COALESCE(btrim(b.subject_name),'') = '';
UPDATE public.learning_center_bookings b SET classroom_name = c.name
FROM public.classrooms c WHERE c.id = b.classroom_id AND COALESCE(btrim(b.classroom_name),'') = '';
UPDATE public.learning_center_bookings b SET teacher_name = btrim(concat_ws(' ', COALESCE(p.prefix,''), p.first_name, p.last_name))
FROM public.personnel p WHERE p.id = b.teacher_id AND COALESCE(btrim(b.teacher_name),'') = '';

UPDATE public.pp5_files f SET subject_name = COALESCE(sj.name_th, sj.code)
FROM public.subjects sj WHERE sj.id = f.subject_id AND COALESCE(btrim(f.subject_name),'') = '';
UPDATE public.pp5_files f SET teacher_name = btrim(concat_ws(' ', COALESCE(p.prefix,''), p.first_name, p.last_name))
FROM public.personnel p WHERE p.id = f.personnel_id AND COALESCE(btrim(f.teacher_name),'') = '';

UPDATE public.pp6_files f SET classroom_name = c.name
FROM public.classrooms c WHERE c.id = f.classroom_id AND COALESCE(btrim(f.classroom_name),'') = '';
UPDATE public.pp6_files f SET teacher_name = btrim(concat_ws(' ', COALESCE(p.prefix,''), p.first_name, p.last_name))
FROM public.personnel p WHERE p.id = f.personnel_id AND COALESCE(btrim(f.teacher_name),'') = '';

UPDATE public.ict_loans l SET subject_name = COALESCE(sj.name_th, sj.code)
FROM public.subjects sj WHERE sj.id = l.subject_id AND COALESCE(btrim(l.subject_name),'') = '';

UPDATE public.question_bank q SET subject_name = COALESCE(sj.name_th, sj.code)
FROM public.subjects sj WHERE sj.id = q.subject_id AND COALESCE(btrim(q.subject_name),'') = '';

UPDATE public.student_enrollment_history h SET classroom_name = c.name
FROM public.classrooms c WHERE c.id = h.classroom_id AND COALESCE(btrim(h.classroom_name),'') = '';
