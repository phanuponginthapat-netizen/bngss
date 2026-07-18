
-- ============================================================
-- 1) Auto-update updated_at triggers for all major tables
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'students', 'personnel', 'classrooms', 'subjects', 
      'profiles', 'cms_pages', 'cms_settings', 'news_posts',
      'assets', 'google_chat_webhooks'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ============================================================
-- 2) Auto-compute total_score when student_scores are inserted/updated
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_compute_total_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_score := COALESCE(NEW.assignment_score, 0) 
                   + COALESCE(NEW.midterm_score, 0) 
                   + COALESCE(NEW.final_score, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS compute_total_score ON public.student_scores;
CREATE TRIGGER compute_total_score
  BEFORE INSERT OR UPDATE ON public.student_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_compute_total_score();

-- ============================================================
-- 3) Notify admin when staff leave is created
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_staff_leave()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
  personnel_name TEXT;
BEGIN
  -- Get personnel name
  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO personnel_name
  FROM public.personnel WHERE id = NEW.personnel_id;

  -- Create notification for all admins
  FOR admin_id IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      admin_id,
      'คำขอลา: ' || COALESCE(personnel_name, 'ไม่ระบุ'),
      COALESCE(personnel_name, '') || ' ขอลา' || NEW.leave_type || ' วันที่ ' || NEW.start_date || ' - ' || NEW.end_date,
      'leave',
      'staff_leave',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notify_staff_leave ON public.staff_leaves;
CREATE TRIGGER notify_staff_leave
  AFTER INSERT ON public.staff_leaves
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_staff_leave();

-- ============================================================
-- 4) Notify on negative behavior record
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_negative_behavior()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
  student_name TEXT;
BEGIN
  IF NEW.behavior_type = 'negative' THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO student_name
    FROM public.students WHERE id = NEW.student_id;

    FOR admin_id IN 
      SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'director')
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
      VALUES (
        admin_id,
        'พฤติกรรมเชิงลบ: ' || COALESCE(student_name, 'ไม่ระบุ'),
        COALESCE(student_name, '') || ' - ' || NEW.description || ' (' || COALESCE(NEW.points::TEXT, '0') || ' คะแนน)',
        'behavior',
        'behavior_record',
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notify_negative_behavior ON public.behavior_records;
CREATE TRIGGER notify_negative_behavior
  AFTER INSERT ON public.behavior_records
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_negative_behavior();

-- ============================================================
-- 5) Auto-create notification when document is created
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_document_created()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
BEGIN
  FOR admin_id IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      admin_id,
      'เอกสารใหม่: ' || NEW.title,
      'เลขที่ ' || NEW.doc_number || ' - ' || NEW.doc_type || ' จาก ' || COALESCE(NEW.from_department, '-'),
      'document',
      'document',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notify_document_created ON public.documents;
CREATE TRIGGER notify_document_created
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_document_created();

-- ============================================================
-- 6) Auto-create screening record when student is created
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_create_student_screening()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.student_screenings (student_id, screening_type, category, screened_by)
  VALUES (NEW.id, 'initial', 'ปกติ', 'ระบบอัตโนมัติ');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS auto_screening_on_student ON public.students;
CREATE TRIGGER auto_screening_on_student
  AFTER INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_student_screening();

-- ============================================================
-- 7) Notify admin when student leave is created
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_student_leave()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
  student_name TEXT;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO student_name
  FROM public.students WHERE id = NEW.student_id;

  FOR admin_id IN 
    SELECT user_id FROM public.user_roles WHERE role IN ('admin', 'teacher')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      admin_id,
      'นักเรียนลา: ' || COALESCE(student_name, 'ไม่ระบุ'),
      COALESCE(student_name, '') || ' ลา' || NEW.leave_type || ' ' || NEW.start_date || ' - ' || NEW.end_date,
      'leave',
      'student_leave',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notify_student_leave ON public.student_leaves;
CREATE TRIGGER notify_student_leave
  AFTER INSERT ON public.student_leaves
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_student_leave();

-- ============================================================
-- 8) Auto-notify on emergency broadcast
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_emergency()
RETURNS TRIGGER AS $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT user_id FROM public.user_roles
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      user_record.user_id,
      '🚨 ' || NEW.title,
      NEW.message,
      'emergency',
      'emergency',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS notify_emergency ON public.emergency_broadcasts;
CREATE TRIGGER notify_emergency
  AFTER INSERT ON public.emergency_broadcasts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_emergency();
