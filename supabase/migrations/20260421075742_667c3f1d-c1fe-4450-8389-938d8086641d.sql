
-- ============================================
-- 1. INBOX TABLE (Unified Inbox)
-- ============================================
CREATE TABLE IF NOT EXISTS public.inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  item_type text NOT NULL DEFAULT 'notification', -- notification | document | approval | task
  category text, -- leave | substitute | damage | document | attendance | behavior | etc.
  reference_table text,
  reference_id uuid,
  action_url text,
  is_read boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_user ON public.inbox_items(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_ref ON public.inbox_items(reference_table, reference_id);

ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own inbox" ON public.inbox_items
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users update own inbox" ON public.inbox_items
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users delete own inbox" ON public.inbox_items
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "System can insert inbox" ON public.inbox_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin manage all inbox" ON public.inbox_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_items;

-- ============================================
-- 2. AUTO: notification → inbox
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_notification_to_inbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.inbox_items (user_id, title, message, item_type, category, reference_table, reference_id, priority)
  VALUES (
    NEW.user_id,
    NEW.title,
    NEW.message,
    'notification',
    NEW.type,
    NEW.reference_type,
    NEW.reference_id,
    CASE WHEN NEW.type = 'emergency' THEN 'urgent'
         WHEN NEW.type IN ('leave','behavior') THEN 'high'
         ELSE 'normal' END
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_notification_inbox ON public.notifications;
CREATE TRIGGER trg_sync_notification_inbox
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_notification_to_inbox();

-- ============================================
-- 3. AUTO: ลาครูอนุมัติ → สร้างสอนแทนจาก schedules
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_create_substitute_on_leave_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d date;
  teacher_name text;
  sched RECORD;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO teacher_name
      FROM public.personnel WHERE id = NEW.personnel_id;

    d := NEW.start_date;
    WHILE d <= NEW.end_date LOOP
      FOR sched IN
        SELECT s.id, s.subject_id, s.classroom_id, s.period_number, s.day_of_week
        FROM public.schedules s
        JOIN public.personnel p ON p.id = NEW.personnel_id
        WHERE s.teacher_name = CONCAT(p.prefix, p.first_name, ' ', p.last_name)
          AND s.day_of_week = (EXTRACT(DOW FROM d)::int + 6) % 7 + 1
      LOOP
        INSERT INTO public.substitute_teaching
          (original_teacher, substitute_teacher, subject_id, classroom_id, teaching_date, period, status, notes)
        VALUES
          (teacher_name, NULL, sched.subject_id, sched.classroom_id, d,
           'คาบ ' || sched.period_number, 'pending',
           'สร้างอัตโนมัติจากคำลา ' || NEW.leave_type)
        ON CONFLICT DO NOTHING;
      END LOOP;
      d := d + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_substitute ON public.staff_leaves;
CREATE TRIGGER trg_auto_substitute
  AFTER UPDATE ON public.staff_leaves
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_substitute_on_leave_approval();

-- ============================================
-- 4. AUTO: แจ้งซ่อม → แจ้งเตือนแอดมิน
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_on_damage_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_id uuid;
  asset_name_v text;
BEGIN
  SELECT asset_name INTO asset_name_v FROM public.assets WHERE id = NEW.asset_id;

  FOR admin_id IN
    SELECT user_id FROM public.user_roles WHERE role IN ('admin','director')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      admin_id,
      '🛠️ แจ้งซ่อมพัสดุ: ' || COALESCE(asset_name_v,'ไม่ระบุ'),
      COALESCE(NEW.reporter_name,'') || ' - ' || NEW.description,
      'damage', 'asset_damage_report', NEW.id
    );
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_damage ON public.asset_damage_reports;
CREATE TRIGGER trg_notify_damage
  AFTER INSERT ON public.asset_damage_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_damage_report();

-- ============================================
-- 5. AUTO: นักเรียนขาดเรียน → แจ้งผู้ปกครอง
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_parents_on_absence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parent_uid uuid;
  student_name text;
BEGIN
  IF NEW.status = 'absent' THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO student_name
      FROM public.students WHERE id = NEW.student_id;

    FOR parent_uid IN
      SELECT parent_user_id FROM public.parent_student_links
      WHERE student_id = NEW.student_id
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
      VALUES (
        parent_uid,
        '📌 บุตรหลานขาดเรียน',
        COALESCE(student_name,'') || ' ขาดเรียนวันที่ ' || NEW.attendance_date,
        'attendance', 'attendance', NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_parents_absence ON public.attendance;
CREATE TRIGGER trg_notify_parents_absence
  AFTER INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.notify_parents_on_absence();
