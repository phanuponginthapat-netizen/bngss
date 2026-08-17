-- Compatibility shim: ensure columns/enum values ที่ migration ถัดไปต้องใช้ มีอยู่จริง
DO $enumcreate$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.app_role AS ENUM ('admin','teacher','student','director','alumni','parent','observer');
  END IF;
END
$enumcreate$;
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'observer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'alumni';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'personnel';

DO $compat$
BEGIN
  IF to_regclass('public.students') IS NOT NULL THEN
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_user_id uuid;
    ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_user_id_2 uuid;
  END IF;
END
$compat$;

-- helper: is_staff_user (สร้างเมื่อยังไม่มี เพื่อให้ policy รุ่นถัดไปใช้งานได้)
DO $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_staff_user'
  ) THEN
    EXECUTE $f$
      CREATE FUNCTION public.is_staff_user(_user_id uuid DEFAULT auth.uid())
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = _user_id
            AND role::text IN ('admin','director','teacher','personnel')
        )
      $body$;
    $f$;
  END IF;
END
$fn$;
