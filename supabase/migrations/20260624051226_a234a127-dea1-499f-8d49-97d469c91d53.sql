-- ============================================================
-- 1) student_leaves (approved) → auto-fill attendance "ลา"
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_leave_to_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
  v_year int;
  v_sem int;
BEGIN
  -- ทำเฉพาะตอนเปลี่ยนเป็น approved
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN RETURN NEW; END IF;
  IF NEW.start_date IS NULL OR NEW.end_date IS NULL THEN RETURN NEW; END IF;

  -- คำนวณปีการศึกษา/ภาคเรียน (พ.ค.-ก.ย. = ภาค 1, ต.ค.-มี.ค. = ภาค 2)
  v_year := EXTRACT(YEAR FROM NEW.start_date)::int;
  v_sem := CASE WHEN EXTRACT(MONTH FROM NEW.start_date) BETWEEN 5 AND 9 THEN 1 ELSE 2 END;

  v_date := NEW.start_date;
  WHILE v_date <= NEW.end_date LOOP
    -- ข้ามวันเสาร์-อาทิตย์ (DOW: 0=Sun, 6=Sat)
    IF EXTRACT(DOW FROM v_date) NOT IN (0, 6) THEN
      INSERT INTO public.attendance (
        student_id, attendance_date, status, notes, academic_year, semester
      ) VALUES (
        NEW.student_id, v_date, 'leave',
        'ลาอัตโนมัติ: ' || COALESCE(NEW.leave_type, 'ลา'),
        v_year, v_sem
      )
      ON CONFLICT (student_id, attendance_date, subject_id)
        DO UPDATE SET status = 'leave',
                      notes = EXCLUDED.notes
        WHERE public.attendance.status NOT IN ('present', 'late');
    END IF;
    v_date := v_date + 1;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- ถ้า unique constraint ไม่ตรง หรือ DOW ผิด ให้เงียบ
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_leave_to_attendance ON public.student_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_sync_leave_to_attendance
AFTER INSERT OR UPDATE OF status ON public.student_leaves
FOR EACH ROW EXECUTE FUNCTION public.sync_leave_to_attendance()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============================================================
-- 2) homework_submissions (graded) → notify parents via LINE
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_parents_on_homework_graded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_max numeric;
  v_student_name text;
  v_msg text;
BEGIN
  IF NEW.final_score IS NULL OR COALESCE(NEW.status, '') <> 'graded' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'graded' AND OLD.final_score IS NOT DISTINCT FROM NEW.final_score THEN
    RETURN NEW;
  END IF;

  SELECT title, total_score INTO v_title, v_max
    FROM public.homework_assignments WHERE id = NEW.assignment_id;
  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO v_student_name
    FROM public.students WHERE id = NEW.student_id;

  v_msg := 'การบ้าน "' || COALESCE(v_title, '-') || '" • คะแนน ' ||
           NEW.final_score::text || '/' || COALESCE(v_max::text, '-');

  BEGIN
    PERFORM public.send_line_to_student_parents(
      NEW.student_id,
      '📝 ตรวจการบ้านแล้ว: ' || COALESCE(v_student_name, ''),
      v_msg
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- in-app notification ให้นักเรียนด้วย
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT p.id, '📝 ครูตรวจการบ้านแล้ว', v_msg, 'homework_graded', '/student/homework'
    FROM public.profiles p WHERE p.id = NEW.student_id;

  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_homework_graded ON public.homework_submissions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_homework_graded
AFTER INSERT OR UPDATE OF final_score, status
ON public.homework_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_parents_on_homework_graded()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============================================================
-- 3) sync_homework_to_pp5: handle classroom_id change
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_homework_to_pp5()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_column_id uuid;
  v_max numeric;
  v_order int;
BEGIN
  IF NEW.subject_id IS NULL OR NEW.classroom_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_max := COALESCE(NEW.total_score, 10);

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_order
      FROM public.subject_score_columns WHERE subject_id = NEW.subject_id;

    INSERT INTO public.subject_score_columns (
      subject_id, column_name, column_type, max_score, sort_order, half, homework_assignment_id
    ) VALUES (
      NEW.subject_id, COALESCE(NEW.title, 'การบ้าน'),
      'assignment', v_max, v_order, 'pre', NEW.id
    )
    RETURNING id INTO v_column_id;

    INSERT INTO public.student_column_scores (student_id, column_id, score, status)
    SELECT s.id, v_column_id, 0, 'pending'
      FROM public.students s
      WHERE s.classroom_id = NEW.classroom_id AND s.status = 'active'
    ON CONFLICT (student_id, column_id) DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.subject_score_columns
       SET column_name = COALESCE(NEW.title, column_name),
           max_score = COALESCE(NEW.total_score, max_score)
     WHERE homework_assignment_id = NEW.id
    RETURNING id INTO v_column_id;

    -- ถ้าเปลี่ยนห้อง: ลบคะแนน pending ของห้องเดิม + seed นักเรียนห้องใหม่
    IF v_column_id IS NOT NULL
       AND NEW.classroom_id IS DISTINCT FROM OLD.classroom_id THEN
      DELETE FROM public.student_column_scores
        WHERE column_id = v_column_id
          AND status = 'pending';
      INSERT INTO public.student_column_scores (student_id, column_id, score, status)
      SELECT s.id, v_column_id, 0, 'pending'
        FROM public.students s
        WHERE s.classroom_id = NEW.classroom_id AND s.status = 'active'
      ON CONFLICT (student_id, column_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
-- ============================================================
-- 4) Realtime: เพิ่ม profiles + homework_submissions เข้า publication
-- ============================================================
DO $$
BEGIN
  BEGIN
          IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'profiles'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
      END IF;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
          IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'homework_submissions'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.homework_submissions;
      END IF;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
