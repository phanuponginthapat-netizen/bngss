-- 1) นโยบายการเก็บรักษาข้อมูลตามระเบียบกระทรวงศึกษาธิการ / สพฐ. / งานสารบรรณ
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  code            text PRIMARY KEY,
  label           text NOT NULL,
  tables          text[] NOT NULL DEFAULT '{}',
  retention_years int,                       -- NULL = เก็บถาวร
  legal_basis     text,
  sort_order      int NOT NULL DEFAULT 100,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.data_retention_policies TO authenticated;
GRANT ALL ON public.data_retention_policies TO service_role;

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "retention_read_auth" ON public.data_retention_policies;
CREATE POLICY "retention_read_auth" ON public.data_retention_policies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "retention_manage_admin" ON public.data_retention_policies;
CREATE POLICY "retention_manage_admin" ON public.data_retention_policies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TRIGGER trg_retention_updated_at
  BEFORE UPDATE ON public.data_retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.data_retention_policies (code, label, tables, retention_years, legal_basis, sort_order) VALUES
  ('pp1_transcript',  'ปพ.1 ระเบียนแสดงผลการเรียน',        ARRAY['student_scores','enrollments'],                    NULL, 'ระเบียบ สพฐ. ว่าด้วยเอกสารหลักฐานการศึกษา — เก็บถาวร', 10),
  ('pp2_pp3_graduate','ปพ.2/ปพ.3 หลักฐานสำเร็จการศึกษา',    ARRAY['students'],                                        NULL, 'ระเบียบ สพฐ. ว่าด้วยเอกสารหลักฐานการศึกษา — เก็บถาวร', 20),
  ('student_registry','ทะเบียนนักเรียน / ประวัตินักเรียน',    ARRAY['students','admissions'],                           NULL, 'ทะเบียนหลักของสถานศึกษา — เก็บถาวร', 30),
  ('personnel_record','ทะเบียนประวัติบุคลากร',              ARRAY['personnel','salary_records'],                      NULL, 'ระเบียบงานบุคคล — เก็บถาวร', 40),
  ('pp5_scores',      'ปพ.5 บันทึกผลการเรียนรายวิชา',        ARRAY['pp5_files','student_scores'],                         5, 'ระเบียบ สพฐ. — เก็บอย่างน้อย 5 ปี', 50),
  ('pp6_report',      'ปพ.6 สมุดรายงานผลการพัฒนาผู้เรียน',   ARRAY['pp6_files'],                                          5, 'ระเบียบ สพฐ. — เก็บอย่างน้อย 5 ปี', 60),
  ('attendance',      'บันทึกเวลาเรียน / การมาเรียน',        ARRAY['attendance','face_scan_logs'],                        5, 'ระเบียบวัดผล — เก็บอย่างน้อย 5 ปี', 70),
  ('behavior_health', 'พฤติกรรม / สุขภาพ / เยี่ยมบ้าน',      ARRAY['behavior_records','health_records','home_visits'],    5, 'ระบบดูแลช่วยเหลือนักเรียน — 5 ปี', 80),
  ('official_docs',   'หนังสือราชการ / สารบรรณ / e-Form',    ARRAY['documents','eforms','saraban_documents'],            10, 'ระเบียบสำนักนายกฯ ว่าด้วยงานสารบรรณ — 10 ปี', 90),
  ('finance',         'การเงิน / พัสดุ / จัดซื้อจัดจ้าง',      ARRAY['budget_transactions','procurement_records','disbursements','assets'], 10, 'ระเบียบการเงินการคลัง — 10 ปี', 100),
  ('hr_time',         'บันทึกเวลาปฏิบัติงาน / การลา',         ARRAY['time_clock','staff_leaves'],                          5, 'ระเบียบงานบุคคล — 5 ปี', 110),
  ('runtime_logs',    'บันทึกระบบ / แจ้งเตือน (ชั่วคราว)',    ARRAY['notifications','inbox_items','error_logs','audit_logs'], 1, 'ข้อมูลปฏิบัติการ — เก็บ 1 ปี', 200)
ON CONFLICT (code) DO NOTHING;

-- 2) ทะเบียนไฟล์สำรองบน Google Drive (จัดโฟลเดอร์ตามปีการศึกษา/งาน)
CREATE TABLE IF NOT EXISTS public.drive_archives (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_be int NOT NULL,
  module_code      text NOT NULL,
  module_label     text,
  table_name       text NOT NULL,
  file_id          text NOT NULL,
  file_name        text NOT NULL,
  web_link         text,
  folder_path      text,
  row_count        int NOT NULL DEFAULT 0,
  byte_size        bigint NOT NULL DEFAULT 0,
  format           text NOT NULL DEFAULT 'json',
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drive_archives_year_module ON public.drive_archives (academic_year_be DESC, module_code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_drive_archives_file ON public.drive_archives (file_id);

GRANT SELECT ON public.drive_archives TO authenticated;
GRANT ALL ON public.drive_archives TO service_role;

ALTER TABLE public.drive_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drive_archives_admin_read" ON public.drive_archives;
CREATE POLICY "drive_archives_admin_read" ON public.drive_archives
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TRIGGER trg_drive_archives_updated_at
  BEFORE UPDATE ON public.drive_archives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) ตรวจว่าปีการศึกษานั้นสำรองขึ้น Drive แล้วหรือยัง
CREATE OR REPLACE FUNCTION public.is_year_archived(_year_be int)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.drive_archives WHERE academic_year_be = _year_be)
$$;

GRANT EXECUTE ON FUNCTION public.is_year_archived(int) TO authenticated, service_role;

-- 4) สรุปสถานะการเก็บข้อมูลรายงาน (ใช้ในหน้า Data Archive)
CREATE OR REPLACE FUNCTION public.get_archive_overview()
RETURNS TABLE (
  academic_year_be int,
  module_code      text,
  module_label     text,
  files            bigint,
  rows_archived    bigint,
  bytes            bigint,
  last_archived_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.academic_year_be,
         a.module_code,
         max(a.module_label),
         count(*)::bigint,
         sum(a.row_count)::bigint,
         sum(a.byte_size)::bigint,
         max(a.created_at)
  FROM public.drive_archives a
  WHERE public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')
  GROUP BY a.academic_year_be, a.module_code
  ORDER BY a.academic_year_be DESC, a.module_code
$$;

GRANT EXECUTE ON FUNCTION public.get_archive_overview() TO authenticated, service_role;