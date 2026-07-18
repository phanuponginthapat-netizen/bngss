
-- 1. Remove iot_devices from realtime (sensitive columns leak via WAL)
ALTER PUBLICATION supabase_realtime DROP TABLE public.iot_devices;

-- 2. Profiles: scope admin/director access by school
DROP POLICY IF EXISTS "Admin and Director can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Admin/Director view profiles in their school"
ON public.profiles FOR SELECT TO authenticated
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
  AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
);

CREATE POLICY "Admins manage profiles in their school"
ON public.profiles FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
);

-- 3. Homework files: scope by ownership / school
DROP POLICY IF EXISTS "Authenticated can read homework files" ON storage.objects;

CREATE POLICY "Homework files: owner or same-school members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'homework-files' AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.task_assignments t
      LEFT JOIN public.classrooms c ON c.id = t.classroom_id
      WHERE t.id::text = split_part(name, '/', 1)
        AND (
          t.assigned_by = auth.uid()
          OR t.assigned_to_user_id = auth.uid()
          OR (c.school_id IS NOT NULL AND c.school_id = public.get_user_school_id(auth.uid()))
        )
    )
  )
);
