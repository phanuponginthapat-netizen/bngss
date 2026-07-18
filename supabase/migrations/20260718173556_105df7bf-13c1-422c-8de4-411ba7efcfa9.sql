
CREATE OR REPLACE FUNCTION public.is_admin_or_director(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'director'::app_role, 'super_admin'::app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_homeroom_teacher_of(_student_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.classrooms c ON c.id = s.classroom_id
    JOIN public.personnel p ON p.id = c.homeroom_teacher_id
    WHERE s.id = _student_id AND p.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_student(_student_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_homeroom_teacher_of(_student_id, _user_id)
    OR EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.teacher_assignments ta ON ta.classroom_id = s.classroom_id
      JOIN public.personnel p ON p.id = ta.personnel_id
      WHERE s.id = _student_id AND p.user_id = _user_id
    )
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of_student(_student_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students
    WHERE id = _student_id
      AND (parent_user_id = _user_id OR parent_user_id_2 = _user_id)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_or_director(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_homeroom_teacher_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_teacher_of_student(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_parent_of_student(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_or_director(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_homeroom_teacher_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_student(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_parent_of_student(uuid, uuid) TO authenticated, service_role;

-- guidance_records: split into confidential vs non-confidential visibility
DROP POLICY IF EXISTS "dept_member_view" ON public.guidance_records;

CREATE POLICY "dept_member_view_nonconf" ON public.guidance_records
FOR SELECT TO authenticated
USING (
  is_confidential = false
  AND has_dept_position(auth.uid(), 'student_affairs'::school_department, 'member'::dept_position)
);

-- Confidential records: only counselor/admin/director (already covered by guidance_staff_all)
-- Add explicit denial for department-only members on confidential rows: nothing to do,
-- since dept_member_view was the only broad-access path.

-- worksheets: require authentication for published rows
DROP POLICY IF EXISTS "ws_read_published" ON public.worksheets;
CREATE POLICY "ws_read_published_auth" ON public.worksheets
FOR SELECT TO authenticated
USING (is_published = true);
