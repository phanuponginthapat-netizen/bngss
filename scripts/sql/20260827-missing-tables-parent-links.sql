-- ============================================================
-- แก้ error ของ Postgres: ตารางที่โค้ดเรียกใช้แต่ไม่มีจริง
-- 2026-08-27 (ใช้กับ backend หลัก gwmszzoqqxmejefhayqf)
-- ============================================================

-- 1) parent_student_links — ใช้โดย src/lib/notificationTriggers.ts
CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  relation text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_student_links TO authenticated;
GRANT ALL ON public.parent_student_links TO service_role;
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parent_student_links_read ON public.parent_student_links;
CREATE POLICY parent_student_links_read ON public.parent_student_links FOR SELECT TO authenticated
  USING (parent_user_id = auth.uid() OR public.is_staff_any(auth.uid()));
DROP POLICY IF EXISTS parent_student_links_admin ON public.parent_student_links;
CREATE POLICY parent_student_links_admin ON public.parent_student_links FOR ALL TO authenticated
  USING (public.is_admin_or_director(auth.uid())) WITH CHECK (public.is_admin_or_director(auth.uid()));

-- backfill จาก students.parent_user_id / parent_user_id_2
INSERT INTO public.parent_student_links (parent_user_id, student_id, relation, is_primary)
SELECT parent_user_id, id, coalesce(parent_relation_1,'ผู้ปกครอง'), true
FROM public.students WHERE parent_user_id IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.parent_student_links (parent_user_id, student_id, relation, is_primary)
SELECT parent_user_id_2, id, coalesce(parent_relation_2,'ผู้ปกครอง'), false
FROM public.students WHERE parent_user_id_2 IS NOT NULL
ON CONFLICT DO NOTHING;

-- ซิงก์อัตโนมัติเมื่อผูกบัญชีผู้ปกครองใหม่ (เช่น สมัครผ่าน QR)
CREATE OR REPLACE FUNCTION public.sync_parent_student_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.parent_user_id IS NOT NULL THEN
    INSERT INTO public.parent_student_links (parent_user_id, student_id, relation, is_primary)
    VALUES (NEW.parent_user_id, NEW.id, COALESCE(NEW.parent_relation_1, 'ผู้ปกครอง'), true)
    ON CONFLICT (parent_user_id, student_id) DO NOTHING;
  END IF;
  IF NEW.parent_user_id_2 IS NOT NULL THEN
    INSERT INTO public.parent_student_links (parent_user_id, student_id, relation, is_primary)
    VALUES (NEW.parent_user_id_2, NEW.id, COALESCE(NEW.parent_relation_2, 'ผู้ปกครอง'), false)
    ON CONFLICT (parent_user_id, student_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_parent_student_links() FROM anon, authenticated, PUBLIC;
DROP TRIGGER IF EXISTS trg_sync_parent_student_links ON public.students;
CREATE TRIGGER trg_sync_parent_student_links
AFTER INSERT OR UPDATE OF parent_user_id, parent_user_id_2 ON public.students
FOR EACH ROW EXECUTE FUNCTION public.sync_parent_student_links();

-- 2) district_outbox — ใช้โดย edge function sis-sync-push
CREATE TABLE IF NOT EXISTS public.district_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.district_outbox TO authenticated;
GRANT ALL ON public.district_outbox TO service_role;
ALTER TABLE public.district_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS district_outbox_admin ON public.district_outbox;
CREATE POLICY district_outbox_admin ON public.district_outbox FOR SELECT TO authenticated
  USING (public.is_admin_or_director(auth.uid()));
