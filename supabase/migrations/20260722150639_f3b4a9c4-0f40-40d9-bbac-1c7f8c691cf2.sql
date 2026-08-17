
-- ========== cms_school_info ==========
CREATE TABLE IF NOT EXISTS public.cms_school_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  title text NOT NULL,
  subtitle text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover_image text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cms_school_info TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_school_info TO authenticated;
GRANT ALL ON public.cms_school_info TO service_role;

ALTER TABLE public.cms_school_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads published info" ON public.cms_school_info;
CREATE POLICY "Public reads published info"
  ON public.cms_school_info FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Admins manage school info" ON public.cms_school_info;
CREATE POLICY "Admins manage school info"
  ON public.cms_school_info FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- ========== cms_downloads ==========
CREATE TABLE IF NOT EXISTS public.cms_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  file_url text NOT NULL,
  file_size bigint,
  file_type text,
  download_count integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cms_downloads TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_downloads TO authenticated;
GRANT ALL ON public.cms_downloads TO service_role;

ALTER TABLE public.cms_downloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads published downloads" ON public.cms_downloads;
CREATE POLICY "Public reads published downloads"
  ON public.cms_downloads FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Admins manage downloads" ON public.cms_downloads;
CREATE POLICY "Admins manage downloads"
  ON public.cms_downloads FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- ========== cms_faqs ==========
CREATE TABLE IF NOT EXISTS public.cms_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cms_faqs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_faqs TO authenticated;
GRANT ALL ON public.cms_faqs TO service_role;

ALTER TABLE public.cms_faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads published faqs" ON public.cms_faqs;
CREATE POLICY "Public reads published faqs"
  ON public.cms_faqs FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Admins manage faqs" ON public.cms_faqs;
CREATE POLICY "Admins manage faqs"
  ON public.cms_faqs FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- ========== cms_nav_menu ==========
CREATE TABLE IF NOT EXISTS public.cms_nav_menu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.cms_nav_menu(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text,
  icon text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  open_in_new_tab boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cms_nav_menu TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_nav_menu TO authenticated;
GRANT ALL ON public.cms_nav_menu TO service_role;

ALTER TABLE public.cms_nav_menu ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads published menu" ON public.cms_nav_menu;
CREATE POLICY "Public reads published menu"
  ON public.cms_nav_menu FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP POLICY IF EXISTS "Admins manage menu" ON public.cms_nav_menu;
CREATE POLICY "Admins manage menu"
  ON public.cms_nav_menu FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- ========== Update triggers ==========
DROP TRIGGER IF EXISTS trg_cms_school_info_updated ON public.cms_school_info;
CREATE TRIGGER trg_cms_school_info_updated BEFORE UPDATE ON public.cms_school_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_cms_downloads_updated ON public.cms_downloads;
CREATE TRIGGER trg_cms_downloads_updated BEFORE UPDATE ON public.cms_downloads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_cms_faqs_updated ON public.cms_faqs;
CREATE TRIGGER trg_cms_faqs_updated BEFORE UPDATE ON public.cms_faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_cms_nav_menu_updated ON public.cms_nav_menu;
CREATE TRIGGER trg_cms_nav_menu_updated BEFORE UPDATE ON public.cms_nav_menu
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== Seed default content ==========
INSERT INTO public.cms_school_info (section_key, title, subtitle, content, sort_order) VALUES
  ('history', 'ประวัติสถานศึกษา', 'ความเป็นมาของโรงเรียน', '{"body":"<p>โรงเรียนก่อตั้งขึ้นเมื่อปี พ.ศ. ... เพื่อให้บริการทางการศึกษาแก่เยาวชนในพื้นที่</p><h3>ปี พ.ศ. 2500</h3><p>เริ่มก่อตั้ง</p>","timeline":[]}', 1),
  ('vision', 'วิสัยทัศน์', 'Vision', '{"body":"<p>มุ่งพัฒนาผู้เรียนให้เป็นคนดี มีความรู้ คู่คุณธรรม สู่ความเป็นสากล</p>"}', 2),
  ('mission', 'พันธกิจ', 'Mission', '{"items":["จัดการศึกษาให้ผู้เรียนมีคุณภาพตามมาตรฐาน","ส่งเสริมคุณธรรม จริยธรรม","พัฒนาครูและบุคลากรอย่างต่อเนื่อง","บริหารจัดการด้วยหลักธรรมาภิบาล"]}', 3),
  ('goals', 'เป้าประสงค์', 'Goals', '{"items":["ผู้เรียนมีผลสัมฤทธิ์ทางการเรียนสูงขึ้น","ผู้เรียนมีทักษะชีวิตและอาชีพ","โรงเรียนเป็นแหล่งเรียนรู้ของชุมชน"]}', 4),
  ('identity', 'อัตลักษณ์ / เอกลักษณ์', 'Identity', '{"identity":"ยิ้มไหว้ ทักทาย มีน้ำใจ","uniqueness":"โรงเรียนแห่งการเรียนรู้ควบคู่คุณธรรม"}', 5),
  ('philosophy', 'ปรัชญา / คำขวัญ', 'Philosophy', '{"philosophy":"ปญฺญา นรานํ รตนํ (ปัญญาเป็นรัตนะของนรชน)","motto":"เรียนดี มีวินัย ใฝ่คุณธรรม","colors":"ฟ้า-ขาว","tree":"ต้นราชพฤกษ์"}', 6),
  ('contact', 'ติดต่อโรงเรียน', 'Contact', '{"address":"","phone":"","email":"","fax":"","map_embed":"","hours":"จันทร์-ศุกร์ 08:00-16:00 น."}', 7)
ON CONFLICT (section_key) DO NOTHING;

-- Seed FAQs
INSERT INTO public.cms_faqs (question, answer, category, sort_order) VALUES
  ('รับสมัครนักเรียนใหม่เมื่อไหร่?', 'เปิดรับสมัครในช่วงเดือนกุมภาพันธ์-มีนาคมของทุกปี ติดตามประกาศได้ที่เว็บไซต์และเพจ Facebook ของโรงเรียน', 'admission', 1),
  ('เอกสารที่ต้องใช้ในการสมัครเรียนมีอะไรบ้าง?', 'สำเนาทะเบียนบ้าน สำเนาบัตรประชาชน สูติบัตร รูปถ่าย และเอกสารผลการเรียนล่าสุด', 'admission', 2),
  ('มีรถรับส่งนักเรียนหรือไม่?', 'มีบริการรถรับส่งครอบคลุมพื้นที่ในเขตบริการ ตรวจสอบเส้นทางได้ที่หน้ารถรับส่งนักเรียน', 'general', 3),
  ('ค่าเทอมประมาณเท่าไหร่?', 'ค่าใช้จ่ายเป็นไปตามระเบียบของโรงเรียน สอบถามเพิ่มเติมได้ที่ฝ่ายทะเบียน', 'admission', 4)
ON CONFLICT DO NOTHING;

-- Seed default navigation
INSERT INTO public.cms_nav_menu (label, url, icon, sort_order) VALUES
  ('หน้าแรก', '/', 'Home', 1),
  ('เกี่ยวกับโรงเรียน', NULL, 'Info', 2),
  ('บุคลากร', NULL, 'Users', 3),
  ('วิชาการ', NULL, 'BookOpen', 4),
  ('ข่าวสาร', '/news', 'Newspaper', 5),
  ('ติดต่อเรา', '/contact', 'Phone', 6)
ON CONFLICT DO NOTHING;

-- Children under "เกี่ยวกับโรงเรียน"
DO $$
DECLARE
  about_id uuid;
  personnel_id uuid;
  academic_id uuid;
BEGIN
  SELECT id INTO about_id FROM public.cms_nav_menu WHERE label='เกี่ยวกับโรงเรียน' AND parent_id IS NULL LIMIT 1;
  SELECT id INTO personnel_id FROM public.cms_nav_menu WHERE label='บุคลากร' AND parent_id IS NULL LIMIT 1;
  SELECT id INTO academic_id FROM public.cms_nav_menu WHERE label='วิชาการ' AND parent_id IS NULL LIMIT 1;

  IF about_id IS NOT NULL THEN
    INSERT INTO public.cms_nav_menu (parent_id, label, url, icon, description, sort_order) VALUES
      (about_id, 'ประวัติสถานศึกษา', '/about/history', 'BookMarked', 'ความเป็นมาของโรงเรียน', 1),
      (about_id, 'วิสัยทัศน์ / พันธกิจ', '/about/vision', 'Target', 'ทิศทางและเป้าหมาย', 2),
      (about_id, 'ปรัชญา / คำขวัญ', '/about/philosophy', 'Award', 'ปรัชญาและอัตลักษณ์', 3),
      (about_id, 'ผังองค์กร', '/about/org-chart', 'Network', 'โครงสร้างการบริหาร', 4);
  END IF;

  IF personnel_id IS NOT NULL THEN
    INSERT INTO public.cms_nav_menu (parent_id, label, url, icon, description, sort_order) VALUES
      (personnel_id, 'ผู้บริหาร', '/personnel?group=admin', 'UserCog', 'ทำเนียบผู้บริหาร', 1),
      (personnel_id, 'ครูและบุคลากร', '/personnel', 'Users', 'ทำเนียบครู', 2),
      (personnel_id, 'กลุ่มสาระการเรียนรู้', '/subject-groups', 'Layers', '8 กลุ่มสาระ', 3);
  END IF;

  IF academic_id IS NOT NULL THEN
    INSERT INTO public.cms_nav_menu (parent_id, label, url, icon, description, sort_order) VALUES
      (academic_id, 'ปฏิทินการศึกษา', '/calendar', 'Calendar', 'กิจกรรมและวันสำคัญ', 1),
      (academic_id, 'ดาวน์โหลดเอกสาร', '/downloads', 'Download', 'เอกสารสำคัญ', 2),
      (academic_id, 'คำถามที่พบบ่อย', '/faq', 'HelpCircle', 'FAQ', 3);
  END IF;
END $$;
