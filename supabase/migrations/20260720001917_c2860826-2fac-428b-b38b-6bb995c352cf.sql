-- 0) ลบใบลาซ้ำ (สถานะ pending) เก็บอันเก่าสุด
DELETE FROM public.staff_leaves a
USING public.staff_leaves b
WHERE a.status='pending' AND b.status='pending'
  AND a.personnel_id=b.personnel_id
  AND a.leave_type=b.leave_type
  AND a.start_date=b.start_date
  AND a.end_date=b.end_date
  AND a.id > b.id;
DELETE FROM public.student_leaves a
USING public.student_leaves b
WHERE a.status='pending' AND b.status='pending'
  AND a.student_id=b.student_id
  AND a.leave_type=b.leave_type
  AND a.start_date=b.start_date
  AND a.end_date=b.end_date
  AND a.id > b.id;
-- 1) unique index กันยื่นซ้ำ
DO $idxguard$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uniq_staff_leaves_pending_personnel_dates
ON public.staff_leaves (personnel_id, leave_type, start_date, end_date)
WHERE status = ''pending''';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uniq_student_leaves_pending_dates
ON public.student_leaves (student_id, leave_type, start_date, end_date)
WHERE status = ''pending''';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- 2) trigger แจ้งเตือนใบลาบุคลากร (admin + director) + กันซ้ำ 5 นาที
CREATE OR REPLACE FUNCTION public.notify_on_staff_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE recipient_id UUID; personnel_name TEXT;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO personnel_name
  FROM public.personnel WHERE id = NEW.personnel_id;

  FOR recipient_id IN
    SELECT DISTINCT user_id FROM public.user_roles
    WHERE role IN ('admin','director') AND user_id IS NOT NULL
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = recipient_id AND reference_type = 'staff_leave'
        AND reference_id = NEW.id AND created_at > now() - interval '5 minutes'
    ) THEN CONTINUE; END IF;

    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      recipient_id,
      'คำขอลา: ' || COALESCE(personnel_name, 'ไม่ระบุ'),
      COALESCE(personnel_name, '') || ' ขอลา' || NEW.leave_type || ' วันที่ ' || NEW.start_date || ' - ' || NEW.end_date,
      'leave','staff_leave', NEW.id
    );
  END LOOP;
  RETURN NEW;
END; $function$;
-- 3) trigger แจ้งเตือนนักเรียนลา — กันซ้ำ 5 นาที
CREATE OR REPLACE FUNCTION public.notify_on_student_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  recipient_id uuid; student_name text;
  classroom_homeroom_id uuid; classroom_homeroom_2_id uuid;
  ht1_user uuid; ht2_user uuid;
BEGIN
  SELECT CONCAT(s.prefix, s.first_name, ' ', s.last_name), c.homeroom_teacher_id, c.homeroom_teacher_2_id
    INTO student_name, classroom_homeroom_id, classroom_homeroom_2_id
  FROM public.students s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
  WHERE s.id = NEW.student_id;

  IF classroom_homeroom_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = classroom_homeroom_id) THEN ht1_user := classroom_homeroom_id;
    ELSE SELECT user_id INTO ht1_user FROM public.personnel WHERE id = classroom_homeroom_id; END IF;
  END IF;
  IF classroom_homeroom_2_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = classroom_homeroom_2_id) THEN ht2_user := classroom_homeroom_2_id;
    ELSE SELECT user_id INTO ht2_user FROM public.personnel WHERE id = classroom_homeroom_2_id; END IF;
  END IF;

  FOR recipient_id IN
    SELECT DISTINCT user_id FROM (
      SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin','director')
      UNION SELECT ht1_user WHERE ht1_user IS NOT NULL
      UNION SELECT ht2_user WHERE ht2_user IS NOT NULL
    ) r
    WHERE user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = r.user_id)
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = recipient_id AND reference_type = 'student_leave'
        AND reference_id = NEW.id AND created_at > now() - interval '5 minutes'
    ) THEN CONTINUE; END IF;

    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      recipient_id,
      'นักเรียนลา: ' || COALESCE(student_name, 'ไม่ระบุ'),
      COALESCE(student_name, '') || ' ลา' || NEW.leave_type || ' ' || NEW.start_date || ' - ' || NEW.end_date,
      'leave','student_leave', NEW.id
    );
  END LOOP;
  RETURN NEW;
END; $function$;
-- 4) ล้างการแจ้งเตือนซ้ำเดิม
DELETE FROM public.notifications n
USING public.notifications n2
WHERE n.reference_type IN ('staff_leave','student_leave')
  AND n.reference_type = n2.reference_type
  AND n.reference_id = n2.reference_id
  AND n.user_id = n2.user_id
  AND n.id > n2.id;
