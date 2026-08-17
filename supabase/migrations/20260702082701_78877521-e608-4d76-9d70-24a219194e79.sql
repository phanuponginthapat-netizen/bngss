
CREATE TABLE IF NOT EXISTS public.dashboard_shortcuts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_th TEXT NOT NULL,
  label_en TEXT NOT NULL,
  icon TEXT,
  logo_url TEXT,
  bg_class TEXT NOT NULL DEFAULT 'bg-gradient-to-br from-slate-400 to-slate-600',
  target_url TEXT NOT NULL,
  open_in_new_tab BOOLEAN NOT NULL DEFAULT false,
  visible_roles TEXT[] NOT NULL DEFAULT ARRAY['admin','director','teacher','student','alumni','parent']::text[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dashboard_shortcuts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dashboard_shortcuts TO authenticated;
GRANT ALL ON public.dashboard_shortcuts TO service_role;

ALTER TABLE public.dashboard_shortcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active shortcuts"
  ON public.dashboard_shortcuts FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert shortcuts"
  ON public.dashboard_shortcuts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update shortcuts"
  ON public.dashboard_shortcuts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete shortcuts"
  ON public.dashboard_shortcuts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_dashboard_shortcuts_updated_at
  BEFORE UPDATE ON public.dashboard_shortcuts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_shortcuts;

-- Seed with existing tiles
INSERT INTO public.dashboard_shortcuts (label_th, label_en, icon, bg_class, target_url, sort_order) VALUES
('เช็คชื่อ-การมาเรียน','Attendance','ClipboardList','bg-gradient-to-br from-emerald-400 to-teal-600','/dashboard/student/attendance',10),
('สแกนนักเรียน','Scan Student','ScanFace','bg-gradient-to-br from-cyan-400 to-blue-600','/dashboard/student/face-scan',20),
('ตารางเรียน-ตารางสอน','Schedule','Calendar','bg-gradient-to-br from-amber-400 to-orange-500','/dashboard/academic/schedule',30),
('การบ้าน','Homework','BookOpenCheck','bg-gradient-to-br from-lime-400 to-emerald-600','/dashboard/homework',40),
('บันทึกผลการเรียน ปพ.5','ปพ.5','ClipboardCheck','bg-gradient-to-br from-fuchsia-400 to-purple-600','/dashboard/academic/pp5',50),
('บันทึกพฤติกรรม','Behavior','Shield','bg-gradient-to-br from-rose-400 to-pink-600','/dashboard/student/behavior',60),
('การลานักเรียน','Leave','FileText','bg-gradient-to-br from-yellow-400 to-amber-500','/dashboard/student/leave',70),
('สุขภาพ','Health','Heart','bg-gradient-to-br from-red-400 to-rose-600','/dashboard/student/health-trend',80),
('ข่าวสาร & ประกาศ','News','Megaphone','bg-gradient-to-br from-orange-400 to-red-500','/dashboard/admin/news',90),
('งบประมาณ & บัญชี','Budget','Wallet','bg-gradient-to-br from-green-400 to-emerald-600','/dashboard/finance/budget',100),
('ทรัพย์สิน & ครุภัณฑ์','Assets','Package','bg-gradient-to-br from-indigo-400 to-purple-600','/dashboard/finance/assets',110),
('บุคลากร','HR','Users','bg-gradient-to-br from-violet-400 to-fuchsia-600','/dashboard/hr/personnel',120),
('กล่องข้อความ','Inbox','Inbox','bg-gradient-to-br from-sky-400 to-blue-600','/dashboard/inbox',130),
('ศูนย์รวมโมดูล','Module Hub','Network','bg-gradient-to-br from-slate-400 to-slate-600','/dashboard/hub',140);
