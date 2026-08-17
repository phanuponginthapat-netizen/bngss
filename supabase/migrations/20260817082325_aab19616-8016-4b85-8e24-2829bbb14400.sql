-- Ensure CMS default settings are present (idempotent)
INSERT INTO public.cms_settings (key, value) VALUES
  ('hero_title', 'Smart School System'),
  ('hero_subtitle', 'ระบบบริหารจัดการโรงเรียนอัจฉริยะ'),
  ('hero_image', ''),
  ('school_name', 'โรงเรียนสมาร์ทสคูล'),
  ('school_address', '123 ถ.การศึกษา อ.เมือง จ.กรุงเทพฯ 10100'),
  ('school_phone', '02-123-4567'),
  ('school_email', 'info@smartschool.ac.th')
ON CONFLICT (key) DO NOTHING;

-- Ensure default homepage pages are present (idempotent)
INSERT INTO public.cms_pages (slug, title, content, is_published, sort_order) VALUES
  ('home', 'หน้าแรก', '<h2>ยินดีต้อนรับสู่โรงเรียนสมาร์ทสคูล</h2><p>โรงเรียนแห่งการเรียนรู้ที่ทันสมัย มุ่งพัฒนาผู้เรียนให้มีคุณภาพ พร้อมก้าวสู่โลกอนาคต</p>', true, 0),
  ('about', 'เกี่ยวกับเรา', '<h2>เกี่ยวกับโรงเรียน</h2><p>โรงเรียนสมาร์ทสคูลก่อตั้งขึ้นเพื่อพัฒนาการศึกษาที่มีคุณภาพ</p>', true, 1),
  ('contact', 'ติดต่อเรา', '<h2>ติดต่อเรา</h2><p>สามารถติดต่อได้ที่เบอร์โทรศัพท์หรืออีเมลของโรงเรียน</p>', true, 2)
ON CONFLICT (slug) DO NOTHING;

-- Ensure default menu items are present (idempotent)
INSERT INTO public.cms_menu_items (label, url, sort_order) VALUES
  ('หน้าแรก', '/', 0),
  ('เกี่ยวกับเรา', '/page/about', 1),
  ('ติดต่อเรา', '/page/contact', 2)
ON CONFLICT DO NOTHING;