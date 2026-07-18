
-- 1) student_leaves
CREATE OR REPLACE FUNCTION public.gchat_on_student_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sname text; cls text;
BEGIN
  SELECT CONCAT(s.prefix, s.first_name, ' ', s.last_name), c.class_name
    INTO sname, cls
    FROM public.students s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.id = NEW.student_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_google_chat(
      'student_leave',
      '📝 คำขอลานักเรียน: ' || COALESCE(sname,'-'),
      'ห้อง ' || COALESCE(cls,'-') || ' • ลา ' || NEW.leave_type,
      'student_affairs','info', NULL,
      jsonb_build_object(
        'ตั้งแต่', to_char(NEW.start_date,'DD/MM/YYYY'),
        'ถึง', to_char(NEW.end_date,'DD/MM/YYYY'),
        'เหตุผล', COALESCE(NEW.reason,'-')
      ),
      'student_leaves', NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM public.notify_google_chat(
      'student_leave',
      '✅ อนุมัติลานักเรียน: ' || COALESCE(sname,'-'),
      'ห้อง ' || COALESCE(cls,'-') || ' • ' || NEW.leave_type,
      'student_affairs','success', NULL,
      jsonb_build_object(
        'ตั้งแต่', to_char(NEW.start_date,'DD/MM/YYYY'),
        'ถึง', to_char(NEW.end_date,'DD/MM/YYYY')
      ),
      'student_leaves', NEW.id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_gchat_student_leave ON public.student_leaves;
CREATE TRIGGER trg_gchat_student_leave AFTER INSERT OR UPDATE ON public.student_leaves
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_student_leave();

-- 2) eforms (new send)
CREATE OR REPLACE FUNCTION public.gchat_on_eform()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rcount int;
BEGIN
  IF NEW.status = 'draft' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'draft' THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO rcount FROM public.eform_recipients WHERE eform_id = NEW.id;

  PERFORM public.notify_google_chat(
    'eform',
    '📨 E-Form ใหม่: ' || NEW.title,
    'จาก ' || COALESCE(NEW.sender_name,'-') || ' • หมวด ' || COALESCE(NEW.category,'-'),
    'general_admin','info', NULL,
    jsonb_build_object(
      'จำนวนผู้รับ', rcount::text,
      'ความเร่งด่วน', COALESCE(NEW.urgency,'normal')
    ),
    'eforms', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_gchat_eform ON public.eforms;
CREATE TRIGGER trg_gchat_eform AFTER INSERT OR UPDATE ON public.eforms
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_eform();

-- 2b) eform_recipients (signed / rejected) — fire once when status flips
CREATE OR REPLACE FUNCTION public.gchat_on_eform_recipient()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE etitle text; total int; signed int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.rejected_at IS NOT NULL AND OLD.rejected_at IS NULL THEN
    SELECT title INTO etitle FROM public.eforms WHERE id = NEW.eform_id;
    PERFORM public.notify_google_chat(
      'eform',
      '❌ E-Form ถูกปฏิเสธ: ' || COALESCE(etitle,'-'),
      COALESCE(NEW.recipient_name,'ผู้รับ') || ' ปฏิเสธการลงนาม',
      'general_admin','warning', NULL,
      jsonb_build_object('เหตุผล', COALESCE(NEW.reject_reason,'-')),
      'eforms', NEW.eform_id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.signed_at IS NOT NULL AND OLD.signed_at IS NULL THEN
    SELECT title INTO etitle FROM public.eforms WHERE id = NEW.eform_id;
    SELECT COUNT(*), COUNT(*) FILTER (WHERE signed_at IS NOT NULL)
      INTO total, signed FROM public.eform_recipients WHERE eform_id = NEW.eform_id;
    IF total > 0 AND signed = total THEN
      PERFORM public.notify_google_chat(
        'eform',
        '✅ E-Form ลงนามครบ: ' || COALESCE(etitle,'-'),
        'ผู้รับทั้งหมด ' || total || ' คน ลงนามครบแล้ว',
        'general_admin','success', NULL,
        NULL, 'eforms', NEW.eform_id
      );
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_gchat_eform_recipient ON public.eform_recipients;
CREATE TRIGGER trg_gchat_eform_recipient AFTER UPDATE ON public.eform_recipients
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_eform_recipient();

-- 3) ict_loans
CREATE OR REPLACE FUNCTION public.gchat_on_ict_loan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE device_name text; borrower text;
BEGIN
  SELECT name INTO device_name FROM public.ict_devices WHERE id = NEW.device_id;
  IF NEW.student_id IS NOT NULL THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO borrower FROM public.students WHERE id = NEW.student_id;
  ELSIF NEW.personnel_id IS NOT NULL THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO borrower FROM public.personnel WHERE id = NEW.personnel_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_google_chat(
      'ict_loan',
      '💻 ยืมอุปกรณ์ ICT',
      COALESCE(borrower,'-') || ' ยืม ' || COALESCE(device_name,'อุปกรณ์'),
      'general_admin','info', NULL,
      jsonb_build_object('กำหนดคืน', COALESCE(to_char(NEW.expected_return_at,'DD/MM/YYYY'),'-')),
      'ict_loans', NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status::text = 'returned' AND OLD.status::text <> 'returned' THEN
    PERFORM public.notify_google_chat(
      'ict_loan',
      '✅ คืนอุปกรณ์ ICT',
      COALESCE(borrower,'-') || ' คืน ' || COALESCE(device_name,'อุปกรณ์'),
      'general_admin','success', NULL,
      jsonb_build_object('สภาพ', COALESCE(NEW.condition_on_return,'-')),
      'ict_loans', NEW.id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_gchat_ict_loan ON public.ict_loans;
CREATE TRIGGER trg_gchat_ict_loan AFTER INSERT OR UPDATE ON public.ict_loans
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_ict_loan();

-- 4) asset_damage_reports
CREATE OR REPLACE FUNCTION public.gchat_on_damage_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE asset_name text;
BEGIN
  SELECT name INTO asset_name FROM public.assets WHERE id = NEW.asset_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_google_chat(
      'asset_damage',
      '🛠️ แจ้งซ่อม/ชำรุด: ' || COALESCE(asset_name,'-'),
      COALESCE(NEW.description,''),
      'general_admin','warning', NULL,
      jsonb_build_object('ผู้แจ้ง', COALESCE(NEW.reporter_name,'-'), 'วันที่', to_char(NEW.report_date,'DD/MM/YYYY')),
      'asset_damage_reports', NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
    PERFORM public.notify_google_chat(
      'asset_damage',
      '✅ ซ่อมเสร็จ: ' || COALESCE(asset_name,'-'),
      COALESCE(NEW.resolution_notes,'-'),
      'general_admin','success', NULL, NULL,
      'asset_damage_reports', NEW.id
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_gchat_damage_report ON public.asset_damage_reports;
CREATE TRIGGER trg_gchat_damage_report AFTER INSERT OR UPDATE ON public.asset_damage_reports
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_damage_report();

-- 5) garbage_deposits — notify on high-value deposits (>=20 points) to avoid spam
CREATE OR REPLACE FUNCTION public.gchat_on_garbage_deposit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who text; item_name text;
BEGIN
  IF COALESCE(NEW.points_earned,0) < 20 THEN RETURN NEW; END IF;
  IF NEW.student_id IS NOT NULL THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO who FROM public.students WHERE id = NEW.student_id;
  ELSIF NEW.personnel_id IS NOT NULL THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO who FROM public.personnel WHERE id = NEW.personnel_id;
  END IF;
  SELECT name INTO item_name FROM public.garbage_items WHERE id = NEW.item_id;

  PERFORM public.notify_google_chat(
    'garbage',
    '♻️ ฝากขยะ: ' || COALESCE(who,'-'),
    COALESCE(item_name,'-') || ' จำนวน ' || NEW.quantity || ' • ได้ ' || NEW.points_earned || ' แต้ม',
    'all','success', NULL, NULL,
    'garbage_deposits', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_gchat_garbage_deposit ON public.garbage_deposits;
CREATE TRIGGER trg_gchat_garbage_deposit AFTER INSERT ON public.garbage_deposits
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_garbage_deposit();

-- 6) garbage_user_badges
CREATE OR REPLACE FUNCTION public.gchat_on_garbage_badge()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who text; bname text; bicon text;
BEGIN
  SELECT name, COALESCE(icon,'🏆') INTO bname, bicon FROM public.garbage_badges WHERE id = NEW.badge_id;
  IF NEW.student_id IS NOT NULL THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO who FROM public.students WHERE id = NEW.student_id;
  ELSIF NEW.personnel_id IS NOT NULL THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO who FROM public.personnel WHERE id = NEW.personnel_id;
  END IF;
  PERFORM public.notify_google_chat(
    'garbage',
    bicon || ' ปลดล็อก Badge: ' || COALESCE(bname,'-'),
    COALESCE(who,'-') || ' ได้รับเหรียญใหม่',
    'all','success', NULL, NULL,
    'garbage_user_badges', NEW.id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_gchat_garbage_badge ON public.garbage_user_badges;
CREATE TRIGGER trg_gchat_garbage_badge AFTER INSERT ON public.garbage_user_badges
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_garbage_badge();

-- 7) Extend notification_types on existing webhooks (additive)
UPDATE public.google_chat_webhooks
SET notification_types = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(notification_types, ARRAY[]::text[]) ||
      ARRAY['student_leave','eform','ict_loan','asset_damage','garbage','summary']
    )
  )
)
WHERE notification_types IS NOT NULL AND array_length(notification_types,1) > 0;
