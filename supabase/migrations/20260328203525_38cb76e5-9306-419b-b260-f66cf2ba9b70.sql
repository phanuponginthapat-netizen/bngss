
-- CMS pages table for admin-managed website content
CREATE TABLE IF NOT EXISTS public.cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content text,
  is_published boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

-- Public can read published pages
DROP POLICY IF EXISTS "Anyone can view published cms pages" ON public.cms_pages;
DROP POLICY IF EXISTS "Anyone can view published cms pages" ON public.cms_pages;
CREATE POLICY "Anyone can view published cms pages" ON public.cms_pages
  FOR SELECT USING (is_published = true);

-- Admins can manage all pages
DROP POLICY IF EXISTS "Admins can manage cms pages" ON public.cms_pages;
DROP POLICY IF EXISTS "Admins can manage cms pages" ON public.cms_pages;
CREATE POLICY "Admins can manage cms pages" ON public.cms_pages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CMS menu items
CREATE TABLE IF NOT EXISTS public.cms_menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  url text,
  page_id uuid REFERENCES public.cms_pages(id) ON DELETE SET NULL,
  sort_order integer DEFAULT 0,
  is_visible boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view visible menu items" ON public.cms_menu_items;
DROP POLICY IF EXISTS "Anyone can view visible menu items" ON public.cms_menu_items;
CREATE POLICY "Anyone can view visible menu items" ON public.cms_menu_items
  FOR SELECT USING (is_visible = true);

DROP POLICY IF EXISTS "Admins can manage menu items" ON public.cms_menu_items;
DROP POLICY IF EXISTS "Admins can manage menu items" ON public.cms_menu_items;
CREATE POLICY "Admins can manage menu items" ON public.cms_menu_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- CMS hero/banner settings
CREATE TABLE IF NOT EXISTS public.cms_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view cms settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Anyone can view cms settings" ON public.cms_settings;
CREATE POLICY "Anyone can view cms settings" ON public.cms_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage cms settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Admins can manage cms settings" ON public.cms_settings;
CREATE POLICY "Admins can manage cms settings" ON public.cms_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Insert default settings (idempotent)
INSERT INTO public.cms_settings (key, value) VALUES
  ('hero_title', 'Smart School System'),
  ('hero_subtitle', 'ระบบบริหารจัดการโรงเรียนอัจฉริยะ'),
  ('hero_image', ''),
  ('school_name', 'โรงเรียนสมาร์ทสคูล'),
  ('school_address', '123 ถ.การศึกษา อ.เมือง จ.กรุงเทพฯ 10100'),
  ('school_phone', '02-123-4567'),
  ('school_email', 'info@smartschool.ac.th')
ON CONFLICT (key) DO NOTHING;

-- Insert default homepage (idempotent)
INSERT INTO public.cms_pages (slug, title, content, is_published, sort_order) VALUES
  ('home', 'หน้าแรก', '<h2>ยินดีต้อนรับสู่โรงเรียนสมาร์ทสคูล</h2><p>โรงเรียนแห่งการเรียนรู้ที่ทันสมัย มุ่งพัฒนาผู้เรียนให้มีคุณภาพ พร้อมก้าวสู่โลกอนาคต</p>', true, 0),
  ('about', 'เกี่ยวกับเรา', '<h2>เกี่ยวกับโรงเรียน</h2><p>โรงเรียนสมาร์ทสคูลก่อตั้งขึ้นเพื่อพัฒนาการศึกษาที่มีคุณภาพ</p>', true, 1),
  ('contact', 'ติดต่อเรา', '<h2>ติดต่อเรา</h2><p>สามารถติดต่อได้ที่เบอร์โทรศัพท์หรืออีเมลของโรงเรียน</p>', true, 2)
ON CONFLICT (slug) DO NOTHING;

-- Insert default menu (idempotent)
INSERT INTO public.cms_menu_items (label, url, sort_order) VALUES
  ('หน้าแรก', '/', 0),
  ('เกี่ยวกับเรา', '/page/about', 1),
  ('ติดต่อเรา', '/page/contact', 2)
ON CONFLICT DO NOTHING;

-- Storage bucket for CMS images
INSERT INTO storage.buckets (id, name, public) VALUES ('cms-images', 'cms-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view cms images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view cms images" ON storage.objects;
CREATE POLICY "Anyone can view cms images" ON storage.objects
  FOR SELECT USING (bucket_id = 'cms-images');

DROP POLICY IF EXISTS "Admins can upload cms images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload cms images" ON storage.objects;
CREATE POLICY "Admins can upload cms images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cms-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete cms images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete cms images" ON storage.objects;
CREATE POLICY "Admins can delete cms images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cms-images' AND public.has_role(auth.uid(), 'admin'));
