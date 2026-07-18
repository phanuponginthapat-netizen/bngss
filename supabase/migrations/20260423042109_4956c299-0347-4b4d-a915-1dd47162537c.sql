
-- ============================================
-- PHASE 1: Multi-tenant Foundation
-- ============================================

-- 1) Extend app_role enum with new roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'area_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'school_admin';
