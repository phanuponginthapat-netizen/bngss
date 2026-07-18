
-- E-Learning Hub: สื่อการเรียนรู้ + การติดตามการใช้

CREATE TABLE public.learning_contents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('html_single','html_zip','youtube','vimeo','pdf','embed')),
  -- เก็บ path หรือ URL ตามชนิด
  storage_path TEXT,          -- สำหรับ html_single/html_zip/pdf (เช่น 'abc/index.html')
  external_url TEXT,          -- สำหรับ youtube/vimeo/embed
  entry_file TEXT,            -- ชื่อไฟล์ entry เช่น 'index.html'
  cover_url TEXT,
  grade_level TEXT,           -- ป.1..ม.6 หรือ 'all'
  subject_group TEXT,
  subject_id UUID,
  visibility TEXT NOT NULL DEFAULT 'school' CHECK (visibility IN ('school','parent','public')),
  public_slug TEXT UNIQUE,
  tracking_enabled BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lc_school ON public.learning_contents(school_id, is_active);
CREATE INDEX idx_lc_owner ON public.learning_contents(owner_id);
CREATE INDEX idx_lc_grade ON public.learning_contents(school_id, grade_level);

GRANT SELECT ON public.learning_contents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_contents TO authenticated;
GRANT ALL ON public.learning_contents TO service_role;

ALTER TABLE public.learning_contents ENABLE ROW LEVEL SECURITY;

-- อ่าน: นักเรียน/ผู้ใช้ใน รร เดียวกันเห็นสื่อใน รร ของตัว
CREATE POLICY "lc_select_school_members" ON public.learning_contents FOR SELECT
TO authenticated USING (
  is_active = true AND (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    OR visibility = 'public'
  )
);
-- อ่านสาธารณะ (anon) เฉพาะ visibility='public' + active
CREATE POLICY "lc_select_public_anon" ON public.learning_contents FOR SELECT
TO anon USING (visibility = 'public' AND is_active = true);

-- เพิ่ม: ครู/แอดมิน/ผอ. ใน รร ของตน
CREATE POLICY "lc_insert_staff" ON public.learning_contents FOR INSERT
TO authenticated WITH CHECK (
  owner_id = auth.uid() AND
  school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) AND
  (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
);

-- แก้/ลบ: เจ้าของ หรือ admin/director ของ รร เดียวกัน
CREATE POLICY "lc_update_owner_or_admin" ON public.learning_contents FOR UPDATE
TO authenticated USING (
  owner_id = auth.uid()
  OR (school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')))
);
CREATE POLICY "lc_delete_owner_or_admin" ON public.learning_contents FOR DELETE
TO authenticated USING (
  owner_id = auth.uid()
  OR (school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')))
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_lc_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER trg_lc_updated_at BEFORE UPDATE ON public.learning_contents
FOR EACH ROW EXECUTE FUNCTION public.tg_lc_updated_at();


-- ── สถิติการเข้าใช้ ──
CREATE TABLE public.learning_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES public.learning_contents(id) ON DELETE CASCADE,
  user_id UUID,                  -- null = anonymous (public link)
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  is_anonymous BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_lv_content ON public.learning_views(content_id, started_at DESC);
CREATE INDEX idx_lv_user ON public.learning_views(user_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.learning_views TO authenticated;
GRANT INSERT, UPDATE ON public.learning_views TO anon;
GRANT ALL ON public.learning_views TO service_role;

ALTER TABLE public.learning_views ENABLE ROW LEVEL SECURITY;

-- ผู้ใช้บันทึก view ของตัวเอง
CREATE POLICY "lv_insert_self" ON public.learning_views FOR INSERT
TO authenticated WITH CHECK (user_id = auth.uid());
-- อัปเดต heartbeat ของตัวเอง
CREATE POLICY "lv_update_self" ON public.learning_views FOR UPDATE
TO authenticated USING (user_id = auth.uid());
-- anonymous (public link) บันทึกได้เมื่อสื่อ public
CREATE POLICY "lv_insert_anon_public" ON public.learning_views FOR INSERT
TO anon WITH CHECK (
  user_id IS NULL AND is_anonymous = true
  AND EXISTS (SELECT 1 FROM public.learning_contents lc WHERE lc.id = content_id AND lc.visibility = 'public' AND lc.is_active = true)
);
CREATE POLICY "lv_update_anon_public" ON public.learning_views FOR UPDATE
TO anon USING (
  user_id IS NULL AND is_anonymous = true
  AND EXISTS (SELECT 1 FROM public.learning_contents lc WHERE lc.id = content_id AND lc.visibility = 'public' AND lc.is_active = true)
);
-- เจ้าของสื่อ + admin/director ดูสถิติได้
CREATE POLICY "lv_select_owner_or_admin" ON public.learning_views FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.learning_contents lc
    WHERE lc.id = content_id AND (
      lc.owner_id = auth.uid()
      OR (lc.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
          AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')))
    )
  )
);
-- ผู้เรียนดูประวัติการเปิดของตัวเองได้
CREATE POLICY "lv_select_self" ON public.learning_views FOR SELECT
TO authenticated USING (user_id = auth.uid());

-- เพิ่ม view_count แบบอัตโนมัติเมื่อสร้าง record ใหม่
CREATE OR REPLACE FUNCTION public.tg_lv_bump_count() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.learning_contents SET view_count = view_count + 1 WHERE id = NEW.content_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lv_bump_count AFTER INSERT ON public.learning_views
FOR EACH ROW EXECUTE FUNCTION public.tg_lv_bump_count();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.learning_contents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.learning_views;
