CREATE OR REPLACE FUNCTION public.notify_on_substitute_teaching()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE uid uuid; subj text; room text; msg text;
BEGIN
  IF NEW.substitute_teacher IS NULL OR btrim(NEW.substitute_teacher) = '' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.substitute_teacher IS NOT DISTINCT FROM NEW.substitute_teacher THEN RETURN NEW; END IF;
  SELECT p.user_id INTO uid FROM public.personnel p
  WHERE p.user_id IS NOT NULL
    AND regexp_replace(btrim(coalesce(p.prefix,'')||coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),'\s+',' ','g')
        = regexp_replace(btrim(NEW.substitute_teacher),'\s+',' ','g')
  LIMIT 1;
  IF uid IS NULL THEN
    SELECT p.user_id INTO uid FROM public.personnel p
    WHERE p.user_id IS NOT NULL AND NEW.substitute_teacher ILIKE '%'||p.first_name||'%'||p.last_name||'%' LIMIT 1;
  END IF;
  IF uid IS NULL THEN RETURN NEW; END IF;
  SELECT name_th INTO subj FROM public.subjects WHERE id = NEW.subject_id;
  SELECT name INTO room FROM public.classrooms WHERE id = NEW.classroom_id;
  msg := 'สอนแทน '||coalesce(NEW.original_teacher,'-')||' วันที่ '||NEW.teaching_date
      ||coalesce(' คาบ '||NEW.period,'')||coalesce(' วิชา '||subj,'')||coalesce(' ห้อง '||room,'');
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE user_id=uid AND reference_type='substitute_teaching' AND reference_id=NEW.id) THEN
    INSERT INTO public.notifications (user_id,title,message,type,reference_type,reference_id)
    VALUES (uid,'📚 มีงานสอนแทน',msg,'substitute','substitute_teaching',NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_substitute ON public.substitute_teaching;
CREATE TRIGGER trg_notify_substitute AFTER INSERT OR UPDATE OF substitute_teacher
ON public.substitute_teaching FOR EACH ROW EXECUTE FUNCTION public.notify_on_substitute_teaching();

CREATE OR REPLACE FUNCTION public.notify_on_eform_recipient()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE e record;
BEGIN
  IF NEW.recipient_id IS NULL THEN RETURN NEW; END IF;
  SELECT title, sender_name, sender_id, urgency INTO e FROM public.eforms WHERE id = NEW.eform_id;
  IF e.sender_id = NEW.recipient_id THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id=NEW.recipient_id AND reference_type='eform' AND reference_id=NEW.eform_id) THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (user_id,title,message,type,reference_type,reference_id)
  VALUES (NEW.recipient_id,
    CASE WHEN e.urgency IN ('urgent','very_urgent','most_urgent') THEN '🔴 e-Form ด่วน: ' ELSE '📝 e-Form ใหม่: ' END||coalesce(e.title,'-'),
    'จาก '||coalesce(e.sender_name,'-')||' รอให้คุณดำเนินการ','eform','eform',NEW.eform_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_eform_recipient ON public.eform_recipients;
CREATE TRIGGER trg_notify_eform_recipient AFTER INSERT
ON public.eform_recipients FOR EACH ROW EXECUTE FUNCTION public.notify_on_eform_recipient();

-- ===== helper: map personnel id or user id → user id =====
CREATE OR REPLACE FUNCTION public._notif_uid(_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT id FROM auth.users WHERE id=_id),(SELECT user_id FROM public.personnel WHERE id=_id))
$$;

CREATE OR REPLACE FUNCTION public._notif_add(_uid uuid,_title text,_msg text,_type text,_ref_type text,_ref uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.notifications WHERE user_id=_uid AND reference_type=_ref_type
             AND reference_id=_ref AND title=_title) THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id,title,message,type,reference_type,reference_id)
  VALUES (_uid,_title,_msg,_type,_ref_type,_ref);
END $$;

-- ===== การบ้านใหม่ → นักเรียนในห้อง + ผู้ปกครอง =====
CREATE OR REPLACE FUNCTION public.notify_on_homework_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; subj text; t text; m text;
BEGIN
  IF NEW.classroom_id IS NULL OR coalesce(NEW.status,'') IN ('draft','archived') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND coalesce(OLD.status,'') NOT IN ('draft') THEN RETURN NEW; END IF;
  SELECT name_th INTO subj FROM public.subjects WHERE id=NEW.subject_id;
  t := '📘 การบ้านใหม่: '||coalesce(NEW.title,'-');
  m := coalesce('วิชา '||subj||' ','')||coalesce('ส่งภายใน '||to_char(NEW.due_date,'DD/MM/YYYY'),'');
  FOR s IN SELECT auth_user_id,parent_user_id,parent_user_id_2 FROM public.students
           WHERE classroom_id=NEW.classroom_id AND coalesce(status,'active') NOT IN ('graduated','transferred','dropped','inactive','จบการศึกษา','ย้าย','ลาออก') LOOP
    PERFORM public._notif_add(s.auth_user_id,t,m,'homework','homework',NEW.id);
    PERFORM public._notif_add(s.parent_user_id,t,m,'homework','homework',NEW.id);
    PERFORM public._notif_add(s.parent_user_id_2,t,m,'homework','homework',NEW.id);
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_homework_assigned ON public.homework_assignments;
CREATE TRIGGER trg_notify_homework_assigned AFTER INSERT OR UPDATE OF status
ON public.homework_assignments FOR EACH ROW EXECUTE FUNCTION public.notify_on_homework_assigned();

-- ===== ผลการลาของครู → ครูผู้ขอลา =====
CREATE OR REPLACE FUNCTION public.notify_staff_leave_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('approved','rejected') THEN RETURN NEW; END IF;
  t := CASE WHEN NEW.status='approved' THEN '✅ อนุมัติการลาแล้ว' ELSE '❌ ไม่อนุมัติการลา' END;
  PERFORM public._notif_add(public._notif_uid(NEW.personnel_id),t,
    'ลา'||coalesce(NEW.leave_type,'')||' วันที่ '||NEW.start_date||' - '||NEW.end_date
    ||coalesce(' เหตุผล: '||NEW.rejected_reason,''),'leave','staff_leave',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_staff_leave_result ON public.staff_leaves;
CREATE TRIGGER trg_notify_staff_leave_result AFTER UPDATE OF status
ON public.staff_leaves FOR EACH ROW EXECUTE FUNCTION public.notify_staff_leave_result();

-- ===== ผลการลาของนักเรียน → นักเรียน + ผู้ปกครอง =====
CREATE OR REPLACE FUNCTION public.notify_student_leave_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; t text; m text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('approved','rejected') THEN RETURN NEW; END IF;
  SELECT auth_user_id,parent_user_id,parent_user_id_2 INTO s FROM public.students WHERE id=NEW.student_id;
  t := CASE WHEN NEW.status='approved' THEN '✅ อนุมัติใบลาแล้ว' ELSE '❌ ไม่อนุมัติใบลา' END;
  m := 'ลา'||coalesce(NEW.leave_type,'')||' วันที่ '||NEW.start_date||' - '||NEW.end_date;
  PERFORM public._notif_add(s.auth_user_id,t,m,'leave','student_leave',NEW.id);
  PERFORM public._notif_add(s.parent_user_id,t,m,'leave','student_leave',NEW.id);
  PERFORM public._notif_add(s.parent_user_id_2,t,m,'leave','student_leave',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_student_leave_result ON public.student_leaves;
CREATE TRIGGER trg_notify_student_leave_result AFTER UPDATE OF status
ON public.student_leaves FOR EACH ROW EXECUTE FUNCTION public.notify_student_leave_result();

-- ===== ผลการจองห้อง → ผู้จอง =====
CREATE OR REPLACE FUNCTION public.notify_room_booking_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('approved','rejected') THEN RETURN NEW; END IF;
  PERFORM public._notif_add(public._notif_uid(NEW.booked_by),
    CASE WHEN NEW.status='approved' THEN '✅ อนุมัติการจองห้อง' ELSE '❌ ไม่อนุมัติการจองห้อง' END,
    coalesce(NEW.room_name,'ห้อง')||' '||to_char(NEW.start_time AT TIME ZONE 'Asia/Bangkok','DD/MM/YYYY HH24:MI')
    ||coalesce(' หมายเหตุ: '||NEW.approval_notes,''),'booking','room_booking',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_room_booking_result ON public.room_bookings;
CREATE TRIGGER trg_notify_room_booking_result AFTER UPDATE OF status
ON public.room_bookings FOR EACH ROW EXECUTE FUNCTION public.notify_room_booking_result();

-- ===== ผลคำขอใช้งบประมาณ → ผู้ขอ =====
CREATE OR REPLACE FUNCTION public.notify_budget_request_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('approved','rejected','returned') THEN RETURN NEW; END IF;
  PERFORM public._notif_add(public._notif_uid(NEW.requester_id),
    CASE NEW.status WHEN 'approved' THEN '✅ อนุมัติคำขอใช้งบ' WHEN 'rejected' THEN '❌ ไม่อนุมัติคำขอใช้งบ' ELSE '↩️ คำขอใช้งบถูกส่งกลับแก้ไข' END,
    coalesce(NEW.request_no||' ','')||coalesce(NEW.title,'-')||' จำนวน '||to_char(coalesce(NEW.amount,0),'FM999,999,990.00')||' บาท',
    'budget','budget_request',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_budget_request_result ON public.budget_requests;
CREATE TRIGGER trg_notify_budget_request_result AFTER UPDATE OF status
ON public.budget_requests FOR EACH ROW EXECUTE FUNCTION public.notify_budget_request_result();

-- ===== ส่งต่อตาม role: ผู้อนุมัติ/ครูผู้สั่ง =====
CREATE OR REPLACE FUNCTION public._notif_roles(_roles text[],_title text,_msg text,_type text,_ref_type text,_ref uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u uuid;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.user_roles WHERE role::text = ANY(_roles) AND user_id IS NOT NULL LOOP
    PERFORM public._notif_add(u,_title,_msg,_type,_ref_type,_ref);
  END LOOP;
END $$;

-- นักเรียนส่งการบ้าน → ครูผู้สั่ง
CREATE OR REPLACE FUNCTION public.notify_teacher_on_homework_submit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a record; sname text;
BEGIN
  IF NEW.status <> 'submitted' OR (TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN RETURN NEW; END IF;
  SELECT title, coalesce(created_by,assigned_by) AS t INTO a FROM public.homework_assignments WHERE id=NEW.assignment_id;
  SELECT concat(prefix,first_name,' ',last_name) INTO sname FROM public.students WHERE id=NEW.student_id;
  PERFORM public._notif_add(public._notif_uid(a.t),'📥 ส่งการบ้าน: '||coalesce(a.title,'-'),
    coalesce(sname,'นักเรียน')||' ส่งงานแล้ว รอตรวจ','homework','homework_submission',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_teacher_homework_submit ON public.homework_submissions;
CREATE TRIGGER trg_notify_teacher_homework_submit AFTER INSERT OR UPDATE OF status
ON public.homework_submissions FOR EACH ROW EXECUTE FUNCTION public.notify_teacher_on_homework_submit();

-- จองห้องใหม่ → ผู้ดูแล/ผู้อำนวยการ
CREATE OR REPLACE FUNCTION public.notify_approvers_room_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(NEW.status,'pending') <> 'pending' THEN RETURN NEW; END IF;
  PERFORM public._notif_roles(ARRAY['admin','school_admin','director'],'🏫 คำขอจองห้องใหม่',
    coalesce(NEW.room_name,'ห้อง')||' '||to_char(NEW.start_time AT TIME ZONE 'Asia/Bangkok','DD/MM/YYYY HH24:MI')
    ||coalesce(' — '||NEW.purpose,''),'booking','room_booking_request',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_approvers_room_booking ON public.room_bookings;
CREATE TRIGGER trg_notify_approvers_room_booking AFTER INSERT
ON public.room_bookings FOR EACH ROW EXECUTE FUNCTION public.notify_approvers_room_booking();

-- ส่งคำขอใช้งบ → ผู้อำนวยการ/ผู้ดูแล
CREATE OR REPLACE FUNCTION public.notify_approvers_budget_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('submitted','pending') OR (TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status) THEN RETURN NEW; END IF;
  PERFORM public._notif_roles(ARRAY['director','admin','school_admin'],'💰 คำขอใช้งบรออนุมัติ',
    coalesce(NEW.request_no||' ','')||coalesce(NEW.title,'-')||' จำนวน '||to_char(coalesce(NEW.amount,0),'FM999,999,990.00')||' บาท'
    ||coalesce(' ('||NEW.department||')',''),'budget','budget_request_pending',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_approvers_budget_request ON public.budget_requests;
CREATE TRIGGER trg_notify_approvers_budget_request AFTER INSERT OR UPDATE OF status
ON public.budget_requests FOR EACH ROW EXECUTE FUNCTION public.notify_approvers_budget_request();

-- e-Form ถูกปฏิเสธ / ลงนามครบ → ผู้ส่ง
CREATE OR REPLACE FUNCTION public.notify_sender_eform_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e record; total int; signed int;
BEGIN
  SELECT title, sender_id INTO e FROM public.eforms WHERE id=NEW.eform_id;
  IF NEW.signed_at IS NOT NULL AND OLD.signed_at IS NULL THEN
    SELECT count(*), count(*) FILTER (WHERE signed_at IS NOT NULL) INTO total, signed
      FROM public.eform_recipients WHERE eform_id=NEW.eform_id;
    IF total>0 AND signed=total THEN
      PERFORM public._notif_add(e.sender_id,'✅ e-Form ลงนามครบ: '||coalesce(e.title,'-'),
        'ผู้รับทั้งหมด '||total||' คน ลงนามครบแล้ว','eform','eform_done',NEW.eform_id);
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_sender_eform_progress ON public.eform_recipients;
CREATE TRIGGER trg_notify_sender_eform_progress AFTER UPDATE OF signed_at
ON public.eform_recipients FOR EACH ROW EXECUTE FUNCTION public.notify_sender_eform_progress();

-- helper: นักเรียน + ผู้ปกครอง
CREATE OR REPLACE FUNCTION public._notif_student(_sid uuid,_title text,_msg text,_type text,_ref_type text,_ref uuid,_parents boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record;
BEGIN
  SELECT auth_user_id,parent_user_id,parent_user_id_2 INTO s FROM public.students WHERE id=_sid;
  PERFORM public._notif_add(s.auth_user_id,_title,_msg,_type,_ref_type,_ref);
  IF _parents THEN
    PERFORM public._notif_add(s.parent_user_id,_title,_msg,_type,_ref_type,_ref);
    PERFORM public._notif_add(s.parent_user_id_2,_title,_msg,_type,_ref_type,_ref);
  END IF;
END $$;

-- พฤติกรรม → นักเรียน ผู้ปกครอง ครูประจำชั้น
CREATE OR REPLACE FUNCTION public.notify_app_on_behavior()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE t text; m text; c record; sname text;
BEGIN
  t := CASE WHEN NEW.behavior_type='positive' THEN '⭐ บันทึกพฤติกรรมดี' ELSE '⚠️ บันทึกพฤติกรรมที่ควรปรับปรุง' END;
  m := coalesce(NEW.description,'-')||coalesce(' ('||NEW.points||' คะแนน)','');
  PERFORM public._notif_student(NEW.student_id,t,m,'behavior','behavior',NEW.id);
  SELECT concat(s.prefix,s.first_name,' ',s.last_name) AS n, cl.homeroom_teacher_id h1, cl.homeroom_teacher_2_id h2
    INTO c FROM public.students s LEFT JOIN public.classrooms cl ON cl.id=s.classroom_id WHERE s.id=NEW.student_id;
  PERFORM public._notif_add(public._notif_uid(c.h1),t||': '||coalesce(c.n,''),m,'behavior','behavior_homeroom',NEW.id);
  PERFORM public._notif_add(public._notif_uid(c.h2),t||': '||coalesce(c.n,''),m,'behavior','behavior_homeroom',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_app_behavior ON public.behavior_records;
CREATE TRIGGER trg_notify_app_behavior AFTER INSERT ON public.behavior_records
FOR EACH ROW EXECUTE FUNCTION public.notify_app_on_behavior();

-- Padlet: โพสต์ใหม่ → เจ้าของบอร์ด
CREATE OR REPLACE FUNCTION public.notify_padlet_note()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE b record;
BEGIN
  SELECT owner_id,title INTO b FROM public.padlet_boards WHERE id=NEW.board_id;
  IF b.owner_id IS NULL OR b.owner_id=NEW.author_id THEN RETURN NEW; END IF;
  PERFORM public._notif_add(b.owner_id,'🧷 โพสต์ใหม่ใน '||coalesce(b.title,'Padlet'),
    coalesce(NEW.author_name,'มีผู้')||': '||left(coalesce(NEW.content,''),80),'padlet','padlet_note',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_padlet_note ON public.padlet_notes;
CREATE TRIGGER trg_notify_padlet_note AFTER INSERT ON public.padlet_notes
FOR EACH ROW EXECUTE FUNCTION public.notify_padlet_note();

-- สั่งงาน: มอบหมาย → ผู้รับ, ส่งงาน → ผู้สั่ง, ตรวจแล้ว → ผู้รับ
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE who text;
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public._notif_add(public._notif_uid(NEW.assigned_to_user_id),'📌 งานที่ได้รับมอบหมาย: '||coalesce(NEW.title,'-'),
      coalesce('กำหนดส่ง '||to_char(NEW.due_date,'DD/MM/YYYY'),'ดูรายละเอียดในระบบ'),'task','task_assignment',NEW.id);
    IF NEW.assigned_to_student_id IS NOT NULL THEN
      PERFORM public._notif_student(NEW.assigned_to_student_id,'📌 งานใหม่: '||coalesce(NEW.title,'-'),
        coalesce('กำหนดส่ง '||to_char(NEW.due_date,'DD/MM/YYYY'),''),'task','task_assignment',NEW.id);
    END IF;
  ELSIF NEW.submitted_at IS NOT NULL AND OLD.submitted_at IS NULL THEN
    SELECT coalesce((SELECT concat(prefix,first_name,' ',last_name) FROM public.students WHERE id=NEW.assigned_to_student_id),
                    (SELECT concat(prefix,first_name,' ',last_name) FROM public.personnel WHERE user_id=NEW.assigned_to_user_id),'ผู้รับงาน') INTO who;
    PERFORM public._notif_add(public._notif_uid(NEW.assigned_by),'📥 ส่งงานแล้ว: '||coalesce(NEW.title,'-'),
      who||' ส่งงานแล้ว','task','task_submitted',NEW.id);
  ELSIF (NEW.grade IS DISTINCT FROM OLD.grade AND NEW.grade IS NOT NULL) OR (NEW.feedback IS DISTINCT FROM OLD.feedback AND NEW.feedback IS NOT NULL) THEN
    PERFORM public._notif_add(public._notif_uid(NEW.assigned_to_user_id),'📝 ตรวจงานแล้ว: '||coalesce(NEW.title,'-'),
      coalesce('ผล: '||NEW.grade||' ','')||coalesce(left(NEW.feedback,80),''),'task','task_graded',NEW.id);
    IF NEW.assigned_to_student_id IS NOT NULL THEN
      PERFORM public._notif_student(NEW.assigned_to_student_id,'📝 ตรวจงานแล้ว: '||coalesce(NEW.title,'-'),
        coalesce('ผล: '||NEW.grade||' ','')||coalesce(left(NEW.feedback,80),''),'task','task_graded',NEW.id,false);
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_task_assignment ON public.task_assignments;
CREATE TRIGGER trg_notify_task_assignment AFTER INSERT OR UPDATE ON public.task_assignments
FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();

-- คะแนน: ประกาศผล ปพ.5 → นักเรียนในห้อง + ผู้ปกครอง (แจ้งเมื่อประกาศเท่านั้น)
CREATE OR REPLACE FUNCTION public.notify_pp5_announced()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; t text; m text;
BEGIN
  IF NEW.announced_at IS NULL OR OLD.announced_at IS NOT NULL OR NEW.classroom_id IS NULL THEN RETURN NEW; END IF;
  t := '📊 ประกาศผลคะแนน: '||coalesce(NEW.subject_name,NEW.subject_code,'-');
  m := 'ภาคเรียน '||coalesce(NEW.semester::text,'-')||'/'||coalesce(NEW.academic_year::text,'-')||' ดูคะแนนรวมและเกรดได้ในระบบ';
  FOR s IN SELECT id FROM public.students WHERE classroom_id=NEW.classroom_id AND coalesce(status,'active')='active' LOOP
    PERFORM public._notif_student(s.id,t,m,'score','pp5_announce',NEW.id);
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_pp5_announced ON public.pp5_files;
CREATE TRIGGER trg_notify_pp5_announced AFTER UPDATE OF announced_at ON public.pp5_files
FOR EACH ROW EXECUTE FUNCTION public.notify_pp5_announced();

-- คะแนนสอบ (ตรวจกระดาษคำตอบ) → นักเรียน
CREATE OR REPLACE FUNCTION public.notify_exam_graded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ttl text;
BEGIN
  IF NEW.student_id IS NULL OR NEW.score IS NULL OR (TG_OP='UPDATE' AND OLD.score IS NOT DISTINCT FROM NEW.score) THEN RETURN NEW; END IF;
  SELECT title INTO ttl FROM public.exams WHERE id=NEW.exam_id;
  PERFORM public._notif_student(NEW.student_id,'🧾 ผลสอบ: '||coalesce(ttl,'-'),
    'ได้ '||NEW.score||coalesce('/'||NEW.total,'')||' คะแนน','score','exam_submission',NEW.id,false);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_exam_graded ON public.exam_submissions;
CREATE TRIGGER trg_notify_exam_graded AFTER INSERT OR UPDATE OF score ON public.exam_submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_exam_graded();

-- แก้ 0/ร/มส: คำร้องใหม่ → ครูวิชา, ครูตอบ/เสร็จ → นักเรียน
CREATE OR REPLACE FUNCTION public.notify_incomplete_fix()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE subj text; sname text;
BEGIN
  SELECT name_th INTO subj FROM public.subjects WHERE id=NEW.subject_id;
  IF TG_OP='INSERT' THEN
    SELECT concat(prefix,first_name,' ',last_name) INTO sname FROM public.students WHERE id=NEW.student_id;
    PERFORM public._notif_add(public._notif_uid(NEW.teacher_id),'🛠️ คำร้องแก้ '||coalesce(NEW.grade_type::text,'ผลการเรียน'),
      coalesce(sname,'นักเรียน')||' วิชา '||coalesce(subj,'-'),'grade_fix','incomplete_fix',NEW.id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public._notif_student(NEW.student_id,'🛠️ คำร้องแก้ '||coalesce(NEW.grade_type::text,'')||': '||NEW.status::text,
      'วิชา '||coalesce(subj,'-')||coalesce(' • งาน: '||NEW.assigned_task,'')||coalesce(' • สอบ '||NEW.exam_date,''),'grade_fix','incomplete_fix',NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_incomplete_fix ON public.incomplete_grade_fix_requests;
CREATE TRIGGER trg_notify_incomplete_fix AFTER INSERT OR UPDATE OF status ON public.incomplete_grade_fix_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_incomplete_fix();

-- งานฝ่ายบริหารทั่วไป: เวรประจำวัน → ครูเวร
CREATE OR REPLACE FUNCTION public.notify_duty_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE loc text;
BEGIN
  SELECT name INTO loc FROM public.duty_locations WHERE id=NEW.location_id;
  PERFORM public._notif_add(public._notif_uid(NEW.teacher_id),'🧭 ได้รับมอบหมายเวร',
    coalesce(loc,'-')||coalesce(' วันที่ '||to_char(NEW.duty_date,'DD/MM/YYYY'),'')||coalesce(' '||NEW.start_time||'-'||NEW.end_time,''),
    'duty','duty_assignment',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_duty_assignment ON public.duty_assignments;
CREATE TRIGGER trg_notify_duty_assignment AFTER INSERT ON public.duty_assignments
FOR EACH ROW EXECUTE FUNCTION public.notify_duty_assignment();

-- ฝ่ายแผนงาน: สถานะโครงการ → ผู้รับผิดชอบ
CREATE OR REPLACE FUNCTION public.notify_project_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.workflow_status IS NOT DISTINCT FROM OLD.workflow_status THEN RETURN NEW; END IF;
  PERFORM public._notif_add(public._notif_uid(coalesce(NEW.responsible_user_id,NEW.created_by)),
    '📋 โครงการ: '||coalesce(NEW.name,'-'),'สถานะเปลี่ยนเป็น '||coalesce(NEW.workflow_status,'-'),'project','hub_project_'||coalesce(NEW.workflow_status,''),NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_project_status ON public.hub_projects;
CREATE TRIGGER trg_notify_project_status AFTER UPDATE OF workflow_status ON public.hub_projects
FOR EACH ROW EXECUTE FUNCTION public.notify_project_status();

-- ฝ่ายงบประมาณ: พัสดุ/จัดซื้อ — คำขอใหม่ → ผอ./ผู้ดูแล, เปลี่ยนสถานะ → ผู้ขอ
CREATE OR REPLACE FUNCTION public.notify_procurement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE m text;
BEGIN
  m := coalesce(NEW.project_name,NEW.description,'-')||' '||to_char(coalesce(NEW.amount,0),'FM999,999,990.00')||' บาท';
  IF TG_OP='INSERT' THEN
    PERFORM public._notif_roles(ARRAY['director','admin','school_admin'],'🛒 คำขอจัดซื้อ/จัดจ้างใหม่',m,'procurement','procurement_new',NEW.id);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public._notif_add(public._notif_uid(NEW.requested_by),'🛒 จัดซื้อ/จัดจ้าง: '||coalesce(NEW.status,'-'),m,
      'procurement','procurement_'||coalesce(NEW.status,''),NEW.id);
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_procurement ON public.procurement_records;
CREATE TRIGGER trg_notify_procurement AFTER INSERT OR UPDATE OF status ON public.procurement_records
FOR EACH ROW EXECUTE FUNCTION public.notify_procurement();

-- ===== แอปก่อน LINE เป็นทางสำรอง (ประหยัดโควต้า LINE) =====
CREATE OR REPLACE FUNCTION public._has_app_device(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id=_uid)
$$;

-- แจ้งเตือนทั่วไป: ส่ง LINE เฉพาะคนที่ยังไม่มีแอป/ยังไม่เปิดรับแจ้งเตือน
CREATE OR REPLACE FUNCTION public.notify_line_on_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u text; k text;
BEGIN
  IF public._has_app_device(NEW.user_id) THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=NEW.user_id AND line_user_id IS NOT NULL) THEN RETURN NEW; END IF;
  IF (SELECT setting_value FROM public.school_settings WHERE setting_key='line_notify_enabled' LIMIT 1) IS DISTINCT FROM 'true' THEN RETURN NEW; END IF;
  u := public.svc_url(); k := public.svc_key();
  IF u IS NULL OR k IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := rtrim(u,'/')||'/functions/v1/notify-line',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||k),
    body := jsonb_build_object('message',coalesce(NEW.title,'')||coalesce(E'\n'||NEW.message,''),'title',NEW.title,
      'user_ids',jsonb_build_array(NEW.user_id),'use_flex',true,'severity','info','notification_type',coalesce(NEW.type,'general')));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

-- LINE ถึงผู้ปกครอง (ขาดเรียน/พฤติกรรม/คะแนน): ข้ามถ้าผู้ปกครองรับแจ้งเตือนในแอปได้แล้ว
CREATE OR REPLACE FUNCTION public.send_line_to_student_parents(_student_id uuid, _title text, _message text, _image_url text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ids text[]; u text; k text; s record;
BEGIN
  IF (SELECT setting_value FROM public.school_settings WHERE setting_key='line_auto_push_enabled' LIMIT 1) IS DISTINCT FROM 'true' THEN RETURN; END IF;
  SELECT line_user_id,line_user_id_2,line_user_id_3,parent_user_id,parent_user_id_2 INTO s FROM public.students WHERE id=_student_id;
  IF public._has_app_device(s.parent_user_id) OR public._has_app_device(s.parent_user_id_2) THEN RETURN; END IF;
  ids := ARRAY(SELECT x FROM unnest(ARRAY[s.line_user_id,s.line_user_id_2,s.line_user_id_3]) x WHERE x IS NOT NULL AND x<>'');
  IF array_length(ids,1) IS NULL THEN RETURN; END IF;
  u := public.svc_url(); k := public.svc_key();
  IF u IS NULL OR k IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url := rtrim(u,'/')||'/functions/v1/notify-line',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||k),
    body := jsonb_build_object('message',coalesce(_title,'')||E'\n'||coalesce(_message,''),'title',_title,
      'line_user_ids',to_jsonb(ids),'image_url',CASE WHEN _image_url LIKE 'https://%' THEN _image_url END,
      'use_flex',true,'severity','info'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== ผู้ปกครอง: ปรับให้ครบทั้ง 2 บัญชี และแก้บัค =====

-- ขาด/สาย → ผู้ปกครองทั้ง 2 บัญชี (+ นักเรียน); LINE เฉพาะเมื่อผู้ปกครองยังไม่มีแอป
CREATE OR REPLACE FUNCTION public.notify_parent_on_absence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; t text; m text; u text; c text;
BEGIN
  IF NEW.status NOT IN ('absent','late') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  SELECT concat(prefix,first_name,' ',last_name) n, parent_user_id p1, parent_user_id_2 p2 INTO s FROM public.students WHERE id=NEW.student_id;
  t := CASE WHEN NEW.status='late' THEN '⏰ มาสาย' ELSE '📌 ขาดเรียน' END;
  m := coalesce(s.n,'')||' — '||CASE WHEN NEW.status='late' THEN 'มาสาย' ELSE 'ขาดเรียน' END||' วันที่ '||to_char(NEW.attendance_date,'DD/MM/YYYY');
  PERFORM public._notif_student(NEW.student_id,t,m,'attendance','attendance',NEW.id);
  IF NOT (public._has_app_device(s.p1) OR public._has_app_device(s.p2)) THEN
    BEGIN
      u := public.svc_url(); c := public.svc_cron();
      IF coalesce(u,'')<>'' AND coalesce(c,'')<>'' THEN
        PERFORM net.http_post(url := rtrim(u,'/')||'/functions/v1/notify-parent-absence',
          headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',c),
          body := jsonb_build_object('attendance_date',NEW.attendance_date::text,'absent_students',
            jsonb_build_array(jsonb_build_object('student_id',NEW.student_id::text,'student_name',s.n,'status',NEW.status))),
          timeout_milliseconds := 5000);
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

-- LINE ขาดเรียนแบบเดิม (ซ้ำกับด้านบน) → ปิด
DROP TRIGGER IF EXISTS trg_notify_parents_on_absence ON public.attendance;

-- ตรวจการบ้านแล้ว: แก้บัค (คอลัมน์ link ไม่มีจริง ทำให้บันทึกคะแนนการบ้านล้ม) → นักเรียน + ผู้ปกครอง
CREATE OR REPLACE FUNCTION public.notify_parents_on_homework_graded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_title text; v_max numeric; m text;
BEGIN
  IF NEW.final_score IS NULL OR coalesce(NEW.status,'')<>'graded' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='graded' AND OLD.final_score IS NOT DISTINCT FROM NEW.final_score THEN RETURN NEW; END IF;
  SELECT title,total_score INTO v_title,v_max FROM public.homework_assignments WHERE id=NEW.assignment_id;
  m := 'การบ้าน "'||coalesce(v_title,'-')||'" ได้ '||NEW.final_score||'/'||coalesce(v_max::text,'-')||' คะแนน';
  PERFORM public._notif_student(NEW.student_id,'📝 ครูตรวจการบ้านแล้ว',m,'homework','homework_graded',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

-- สุขภาพ/วัคซีน → นักเรียน + ผู้ปกครอง
CREATE OR REPLACE FUNCTION public.notify_health_measurement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public._notif_student(NEW.student_id,'📏 บันทึกสุขภาพใหม่','มีการบันทึกน้ำหนัก/ส่วนสูง ดูได้ในเมนูสุขภาพ','health','health_measurement',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.notify_vaccine_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public._notif_student(NEW.student_id,'💉 บันทึกการฉีดวัคซีน',
    coalesce('วัคซีน: '||NEW.vaccine_name,'มีการบันทึกวัคซีนใหม่')||coalesce(' เข็มที่ '||NEW.dose_number,''),'vaccine','vaccine_record',NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

-- การบ้านใหม่: ผู้ปกครองไม่ต้องได้รับทุกชิ้น (ลดแจ้งเตือนเกิน) → แจ้งเฉพาะนักเรียน
CREATE OR REPLACE FUNCTION public.notify_on_homework_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; subj text; t text; m text;
BEGIN
  IF NEW.classroom_id IS NULL OR coalesce(NEW.status,'') IN ('draft','archived') THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND coalesce(OLD.status,'') <> 'draft' THEN RETURN NEW; END IF;
  SELECT name_th INTO subj FROM public.subjects WHERE id=NEW.subject_id;
  t := '📘 การบ้านใหม่: '||coalesce(NEW.title,'-');
  m := coalesce('วิชา '||subj||' ','')||coalesce('ส่งภายใน '||to_char(NEW.due_date,'DD/MM/YYYY'),'');
  FOR s IN SELECT id FROM public.students WHERE classroom_id=NEW.classroom_id AND coalesce(status,'active')='active' LOOP
    PERFORM public._notif_student(s.id,t,m,'homework','homework',NEW.id,false);
  END LOOP;
  RETURN NEW;
  EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

-- ===== ทริกเกอร์ของกลุ่มผู้ปกครอง/สุขภาพ (แก้ไฟล์ตัดขาด) =====
DROP TRIGGER IF EXISTS trg_notify_parents_homework_graded ON public.homework_submissions;
CREATE TRIGGER trg_notify_parents_homework_graded AFTER INSERT OR UPDATE OF final_score, status
ON public.homework_submissions FOR EACH ROW EXECUTE FUNCTION public.notify_parents_on_homework_graded();

DROP TRIGGER IF EXISTS trg_notify_health_measurement ON public.health_measurements;
CREATE TRIGGER trg_notify_health_measurement AFTER INSERT ON public.health_measurements
FOR EACH ROW EXECUTE FUNCTION public.notify_health_measurement();

DROP TRIGGER IF EXISTS trg_notify_vaccine_record ON public.vaccine_records;
CREATE TRIGGER trg_notify_vaccine_record AFTER INSERT ON public.vaccine_records
FOR EACH ROW EXECUTE FUNCTION public.notify_vaccine_record();
