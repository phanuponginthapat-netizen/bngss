
-- 1) Drop functions that reference the old enum type
DROP FUNCTION IF EXISTS public.has_department(uuid, public.school_department);
DROP FUNCTION IF EXISTS public.get_user_departments(uuid);

-- 2) Rename old enum, create new enum
ALTER TYPE public.school_department RENAME TO school_department_old;

CREATE TYPE public.school_department AS ENUM (
  'academic',
  'student_affairs',
  'general_admin',
  'personnel',
  'budget_planning',
  'director_office',
  'finance_personnel' -- kept for backward compatibility; UI will hide it
);

-- 3) Convert user_departments.department to new enum, mapping finance_personnel -> personnel
ALTER TABLE public.user_departments
  ALTER COLUMN department TYPE public.school_department
  USING (
    (CASE department::text
       WHEN 'finance_personnel' THEN 'personnel'
       ELSE department::text
     END)::public.school_department
  );

-- 4) Drop old type
DROP TYPE public.school_department_old;

-- 5) Duplicate existing personnel members into budget_planning (split into both fields)
INSERT INTO public.user_departments (user_id, department, is_head, assigned_by, notes)
SELECT user_id, 'budget_planning'::public.school_department, is_head, assigned_by, notes
FROM public.user_departments
WHERE department = 'personnel'
ON CONFLICT (user_id, department) DO NOTHING;

-- 6) Recreate helper functions
CREATE OR REPLACE FUNCTION public.has_department(_user_id uuid, _dept public.school_department)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_departments
    WHERE user_id = _user_id AND department = _dept
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_departments(_user_id uuid)
RETURNS public.school_department[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(department ORDER BY department), ARRAY[]::public.school_department[])
  FROM public.user_departments WHERE user_id = _user_id;
$$;

REVOKE EXECUTE ON FUNCTION public.has_department(uuid, public.school_department) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_department(uuid, public.school_department) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_departments(uuid) TO authenticated;
