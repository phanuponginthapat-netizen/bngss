-- ระบบหลักสำหรับเขต: ทะเบียนโรงเรียน + รับข้อมูลสรุป (ไม่มีข้อมูลรายคน)
-- รันซ้ำได้ (idempotent)

CREATE TABLE IF NOT EXISTS public.district_hub_schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_code text NOT NULL UNIQUE,
  school_name text NOT NULL,
  area_name text,
  province text,
  deploy_type text NOT NULL DEFAULT 'cloud' CHECK (deploy_type IN ('cloud','standalone','hybrid')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','disabled')),
  enrollment_code_hash text,
  enrollment_expires_at timestamptz,
  ingest_key_hash text,
  enrolled_at timestamptz,
  last_seen_at timestamptz,
  app_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.district_hub_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.district_hub_schools(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_dh_snap_date ON public.district_hub_snapshots (snapshot_date DESC);

CREATE TABLE IF NOT EXISTS public.district_hub_officers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_name text,            -- NULL = เห็นทุกเขต
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, area_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.district_hub_schools TO authenticated;
GRANT SELECT ON public.district_hub_snapshots TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.district_hub_officers TO authenticated;
GRANT ALL ON public.district_hub_schools, public.district_hub_snapshots, public.district_hub_officers TO service_role;

ALTER TABLE public.district_hub_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.district_hub_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.district_hub_officers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_district_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin') OR public.has_role(_uid,'director')
$$;

CREATE OR REPLACE FUNCTION public.can_view_district_school(_uid uuid, _area text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_district_admin(_uid) OR EXISTS (
    SELECT 1 FROM public.district_hub_officers o
    WHERE o.user_id = _uid AND (o.area_name IS NULL OR o.area_name = _area)
  )
$$;

DROP POLICY IF EXISTS "dh schools read" ON public.district_hub_schools;
CREATE POLICY "dh schools read" ON public.district_hub_schools FOR SELECT TO authenticated
  USING (public.can_view_district_school((SELECT auth.uid()), area_name));
DROP POLICY IF EXISTS "dh schools admin write" ON public.district_hub_schools;
CREATE POLICY "dh schools admin write" ON public.district_hub_schools FOR ALL TO authenticated
  USING (public.is_district_admin((SELECT auth.uid())))
  WITH CHECK (public.is_district_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "dh snapshots read" ON public.district_hub_snapshots;
CREATE POLICY "dh snapshots read" ON public.district_hub_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.district_hub_schools s
    WHERE s.id = school_id AND public.can_view_district_school((SELECT auth.uid()), s.area_name)));

DROP POLICY IF EXISTS "dh officers admin" ON public.district_hub_officers;
CREATE POLICY "dh officers admin" ON public.district_hub_officers FOR ALL TO authenticated
  USING (public.is_district_admin((SELECT auth.uid())) OR user_id = (SELECT auth.uid()))
  WITH CHECK (public.is_district_admin((SELECT auth.uid())));

-- ซ่อนกุญแจจากฝั่งเว็บ (อ่านได้เฉพาะ service_role)
REVOKE SELECT (enrollment_code_hash, ingest_key_hash) ON public.district_hub_schools FROM authenticated;
