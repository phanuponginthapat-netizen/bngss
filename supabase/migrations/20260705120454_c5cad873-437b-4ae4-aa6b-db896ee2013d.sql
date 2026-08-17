-- 1) enum ตำแหน่งในฝ่าย/หมวด
DO $$ BEGIN
CREATE TYPE public.dept_role AS ENUM ('member','head','deputy_head','section_head');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) ขยาย user_departments ให้มี dept_role + sync is_head
ALTER TABLE public.user_departments
  ADD COLUMN IF NOT EXISTS dept_role public.dept_role NOT NULL DEFAULT 'member';

UPDATE public.user_departments
   SET dept_role = 'head'
 WHERE is_head = true AND dept_role = 'member';

CREATE OR REPLACE FUNCTION public.sync_user_dept_is_head()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_head := (NEW.dept_role IN ('head','deputy_head'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_departments_sync_is_head ON public.user_departments;
CREATE TRIGGER user_departments_sync_is_head
BEFORE INSERT OR UPDATE OF dept_role ON public.user_departments
FOR EACH ROW EXECUTE FUNCTION public.sync_user_dept_is_head();

-- 3) ตารางกลุ่มสาระการเรียนรู้
CREATE TABLE IF NOT EXISTS public.user_subject_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_group text NOT NULL,
  group_role public.dept_role NOT NULL DEFAULT 'member',
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_group)
);

CREATE INDEX IF NOT EXISTS idx_user_subject_groups_user ON public.user_subject_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subject_groups_group ON public.user_subject_groups(subject_group);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subject_groups TO authenticated;
GRANT ALL ON public.user_subject_groups TO service_role;

ALTER TABLE public.user_subject_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own subject groups" ON public.user_subject_groups;
DROP POLICY IF EXISTS "Users view own subject groups" ON public.user_subject_groups;
CREATE POLICY "Users view own subject groups"
ON public.user_subject_groups FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'director')
);

DROP POLICY IF EXISTS "Admin manage subject groups" ON public.user_subject_groups;
DROP POLICY IF EXISTS "Admin manage subject groups" ON public.user_subject_groups;
CREATE POLICY "Admin manage subject groups"
ON public.user_subject_groups FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP TRIGGER IF EXISTS update_user_subject_groups_updated_at ON public.user_subject_groups;
CREATE TRIGGER update_user_subject_groups_updated_at
BEFORE UPDATE ON public.user_subject_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) helper: role ในฝ่าย
CREATE OR REPLACE FUNCTION public.get_user_dept_role(_user_id uuid, _dept public.school_department)
RETURNS public.dept_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT dept_role FROM public.user_departments
   WHERE user_id = _user_id AND department = _dept
   LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_dept_role(uuid, public.school_department) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_user_dept_role(uuid, public.school_department) TO authenticated;