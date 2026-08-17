
-- ========================================
-- ลบระบบเขตพื้นที่ (Areas/Super Admin) ออกจากระบบ
-- คงตาราง schools และ school_id ไว้สำหรับ multi-school support
-- admin กลับเป็น admin ระดับโรงเรียน
-- ========================================

-- 1) ลบ policies ทั้งหมดที่อ้างถึง area/super_admin/user_schools/can_access_school
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname='public'
      AND (
        COALESCE(qual,'') LIKE '%area%'
        OR COALESCE(qual,'') LIKE '%get_user_school_id%'
        OR COALESCE(qual,'') LIKE '%can_access_school%'
        OR COALESCE(qual,'') LIKE '%is_super_admin%'
        OR COALESCE(qual,'') LIKE '%is_area_admin%'
        OR COALESCE(qual,'') LIKE '%user_schools%'
        OR COALESCE(with_check,'') LIKE '%area%'
        OR COALESCE(with_check,'') LIKE '%get_user_school_id%'
        OR COALESCE(with_check,'') LIKE '%can_access_school%'
        OR COALESCE(with_check,'') LIKE '%is_super_admin%'
        OR COALESCE(with_check,'') LIKE '%is_area_admin%'
        OR COALESCE(with_check,'') LIKE '%user_schools%'
        OR policyname ILIKE '%super%'
        OR policyname ILIKE '%area%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 2) ลบตารางที่เกี่ยวกับ area/broadcast/user_schools
DROP TABLE IF EXISTS public.broadcast_recipients CASCADE;
DROP TABLE IF EXISTS public.area_broadcasts CASCADE;
DROP TABLE IF EXISTS public.user_schools CASCADE;
DROP TABLE IF EXISTS public.areas CASCADE;

-- 3) ลบ helper functions
DROP FUNCTION IF EXISTS public.is_super_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_area_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_area_id(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_access_school(uuid, uuid) CASCADE;

-- 4) ลบ area_id จาก schools
ALTER TABLE public.schools DROP COLUMN IF EXISTS area_id CASCADE;

-- 5) แก้ get_user_school_id ให้ดึงจาก profiles แทน user_schools
DROP FUNCTION IF EXISTS public.get_user_school_id(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_school_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = _user_id LIMIT 1
$$;

-- 6) ดาวน์เกรด role super_admin -> admin (สำหรับ admin@school.com และอื่นๆ)
UPDATE public.user_roles SET role = 'admin'
  WHERE role IN ('super_admin','area_admin','school_admin');

-- 7) ลบค่า enum ที่ไม่ใช้ (ต้องสร้าง type ใหม่)
DO $$
BEGIN
  -- สร้าง enum ใหม่
DO $do$ BEGIN
    CREATE TYPE app_role_new AS ENUM ('admin','teacher','student','director','alumni','parent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $do$;

  -- เปลี่ยน column ทั้งหมดให้ใช้ enum ใหม่
  ALTER TABLE public.user_roles
    ALTER COLUMN role TYPE app_role_new USING role::text::app_role_new;

  -- ลบ type เก่าและ rename
  DROP TYPE app_role;
  ALTER TYPE app_role_new RENAME TO app_role;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Enum migration: %', SQLERRM;
END $$;

-- 8) สร้างตารางสำหรับ District Feed API keys
CREATE TABLE IF NOT EXISTS public.district_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['schools','stats','reports'],
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.district_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage api keys" ON public.district_api_keys;
DROP POLICY IF EXISTS "Admins manage api keys" ON public.district_api_keys;
CREATE POLICY "Admins manage api keys"
  ON public.district_api_keys
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 9) สร้าง audit log สำหรับ district feed
CREATE TABLE IF NOT EXISTS public.district_feed_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.district_api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT,
  ip_address TEXT,
  query_params JSONB,
  response_size INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.district_feed_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view logs" ON public.district_feed_logs;
DROP POLICY IF EXISTS "Admins view logs" ON public.district_feed_logs;
CREATE POLICY "Admins view logs"
  ON public.district_feed_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- 10) สร้าง basic policies ใหม่สำหรับ schools (admin ระดับโรงเรียน)
DROP POLICY IF EXISTS "Admins manage schools" ON public.schools;
DROP POLICY IF EXISTS "Admins manage schools" ON public.schools;
CREATE POLICY "Admins manage schools"
  ON public.schools FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated view schools" ON public.schools;
DROP POLICY IF EXISTS "Authenticated view schools" ON public.schools;
CREATE POLICY "Authenticated view schools"
  ON public.schools FOR SELECT
  USING (auth.uid() IS NOT NULL);
