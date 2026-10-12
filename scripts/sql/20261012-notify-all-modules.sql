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
