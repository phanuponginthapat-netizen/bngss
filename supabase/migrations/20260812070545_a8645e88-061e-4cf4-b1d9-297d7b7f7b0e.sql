-- 1) ฟังก์ชันทริกเกอร์: ไม่ควรถูกเรียกตรงจาก API
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', r.sig);
  END LOOP;
END $$;

-- 2) ฟังก์ชันสำรอง/กู้คืน/โครงสร้างฐานข้อมูล: เฉพาะ service_role
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname LIKE 'export_%' OR p.proname LIKE 'import_%'
           OR p.proname LIKE 'exec_%' OR p.proname LIKE 'archive_%'
           OR p.proname IN ('get_db_schema','district_outbox_enqueue','get_purge_preview','get_cloud_usage_summary'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- 3) ฟังก์ชันภายในที่ต้องล็อกอินก่อน (ตัดสิทธิ์ anon)
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE ALL ON FUNCTION public.current_school_id() FROM anon;
REVOKE ALL ON FUNCTION public.get_personnel_directory() FROM anon;
REVOKE ALL ON FUNCTION public.get_staff_profiles() FROM anon;
REVOKE ALL ON FUNCTION public.parent_child_ids(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.parent_child_codes(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.parent_child_classroom_ids(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.pick_auto_substitute(integer, integer, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.self_enroll_face(jsonb, text[], text) FROM anon;

-- 4) ยืนยันว่าฟังก์ชันสาธารณะที่หน้าเว็บใช้จริงยังเรียกได้
GRANT EXECUTE ON FUNCTION public.get_public_org_chart() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profiles_public(uuid[]) TO anon, authenticated;