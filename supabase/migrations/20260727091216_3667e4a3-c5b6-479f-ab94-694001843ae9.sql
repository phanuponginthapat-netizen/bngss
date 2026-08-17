
-- ============ STAFF LEAVES ============
-- Allow submission also when personnel is matched by employee_code via profiles
DROP POLICY IF EXISTS "Staff can request their own leaves" ON public.staff_leaves;
DROP POLICY IF EXISTS "Staff can request their own leaves" ON public.staff_leaves;
CREATE POLICY "Staff can request their own leaves"
ON public.staff_leaves FOR INSERT TO authenticated
WITH CHECK (
  personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  OR personnel_id IN (
    SELECT p.id FROM public.personnel p
    JOIN public.profiles pr ON pr.employee_code = p.employee_code
    WHERE pr.id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
);

DROP POLICY IF EXISTS "Staff can view their own leaves" ON public.staff_leaves;
DROP POLICY IF EXISTS "Staff can view their own leaves" ON public.staff_leaves;
CREATE POLICY "Staff can view their own leaves"
ON public.staff_leaves FOR SELECT TO authenticated
USING (
  personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  OR personnel_id IN (
    SELECT p.id FROM public.personnel p
    JOIN public.profiles pr ON pr.employee_code = p.employee_code
    WHERE pr.id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
);

DROP POLICY IF EXISTS "Staff can update their own leaves" ON public.staff_leaves;
DROP POLICY IF EXISTS "Staff can update their own leaves" ON public.staff_leaves;
CREATE POLICY "Staff can update their own leaves"
ON public.staff_leaves FOR UPDATE TO authenticated
USING (
  personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
)
WITH CHECK (
  personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
);

DROP POLICY IF EXISTS "Admins can delete staff leaves" ON public.staff_leaves;
DROP POLICY IF EXISTS "Admins can delete staff leaves" ON public.staff_leaves;
CREATE POLICY "Admins can delete staff leaves"
ON public.staff_leaves FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role));

-- ============ PP5 / PP6 FILES: split ALL policy so DELETE is admin-only ============
DROP POLICY IF EXISTS "pp5 owner and admin" ON public.pp5_files;
DROP POLICY IF EXISTS "pp5 insert owner or admin" ON public.pp5_files;
DROP POLICY IF EXISTS "pp5 insert owner or admin" ON public.pp5_files;
CREATE POLICY "pp5 insert owner or admin" ON public.pp5_files
FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid() OR public.is_admin_or_director());
DROP POLICY IF EXISTS "pp5 update owner or admin" ON public.pp5_files;
DROP POLICY IF EXISTS "pp5 update owner or admin" ON public.pp5_files;
CREATE POLICY "pp5 update owner or admin" ON public.pp5_files
FOR UPDATE TO authenticated
USING (uploaded_by = auth.uid() OR public.is_admin_or_director())
WITH CHECK (uploaded_by = auth.uid() OR public.is_admin_or_director());
DROP POLICY IF EXISTS "pp5 delete admin only" ON public.pp5_files;
DROP POLICY IF EXISTS "pp5 delete admin only" ON public.pp5_files;
CREATE POLICY "pp5 delete admin only" ON public.pp5_files
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "pp6 owner and admin" ON public.pp6_files;
DROP POLICY IF EXISTS "pp6 insert owner or admin" ON public.pp6_files;
DROP POLICY IF EXISTS "pp6 insert owner or admin" ON public.pp6_files;
CREATE POLICY "pp6 insert owner or admin" ON public.pp6_files
FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid() OR public.is_admin_or_director());
DROP POLICY IF EXISTS "pp6 update owner or admin" ON public.pp6_files;
DROP POLICY IF EXISTS "pp6 update owner or admin" ON public.pp6_files;
CREATE POLICY "pp6 update owner or admin" ON public.pp6_files
FOR UPDATE TO authenticated
USING (uploaded_by = auth.uid() OR public.is_admin_or_director())
WITH CHECK (uploaded_by = auth.uid() OR public.is_admin_or_director());
DROP POLICY IF EXISTS "pp6 delete admin only" ON public.pp6_files;
DROP POLICY IF EXISTS "pp6 delete admin only" ON public.pp6_files;
CREATE POLICY "pp6 delete admin only" ON public.pp6_files
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ STORAGE POLICIES ============
-- pp5-files bucket: teachers can read+upload, admin can delete
DROP POLICY IF EXISTS "pp5 storage read staff" ON storage.objects;
DROP POLICY IF EXISTS "pp5 storage read staff" ON storage.objects;
CREATE POLICY "pp5 storage read staff" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'pp5-files' AND (public.has_role(auth.uid(),'teacher'::app_role) OR public.is_admin_or_director()));

DROP POLICY IF EXISTS "pp5 storage upload staff" ON storage.objects;
DROP POLICY IF EXISTS "pp5 storage upload staff" ON storage.objects;
CREATE POLICY "pp5 storage upload staff" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pp5-files' AND (public.has_role(auth.uid(),'teacher'::app_role) OR public.is_admin_or_director()));

DROP POLICY IF EXISTS "pp5 storage update owner or admin" ON storage.objects;
DROP POLICY IF EXISTS "pp5 storage update owner or admin" ON storage.objects;
CREATE POLICY "pp5 storage update owner or admin" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'pp5-files' AND (owner = auth.uid() OR public.is_admin_or_director()));

DROP POLICY IF EXISTS "pp5 storage delete admin only" ON storage.objects;
DROP POLICY IF EXISTS "pp5 storage delete admin only" ON storage.objects;
CREATE POLICY "pp5 storage delete admin only" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'pp5-files' AND public.has_role(auth.uid(),'admin'::app_role));

-- pp6-files bucket
DROP POLICY IF EXISTS "pp6 storage read staff" ON storage.objects;
DROP POLICY IF EXISTS "pp6 storage read staff" ON storage.objects;
CREATE POLICY "pp6 storage read staff" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'pp6-files' AND (public.has_role(auth.uid(),'teacher'::app_role) OR public.is_admin_or_director()));

DROP POLICY IF EXISTS "pp6 storage upload staff" ON storage.objects;
DROP POLICY IF EXISTS "pp6 storage upload staff" ON storage.objects;
CREATE POLICY "pp6 storage upload staff" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pp6-files' AND (public.has_role(auth.uid(),'teacher'::app_role) OR public.is_admin_or_director()));

DROP POLICY IF EXISTS "pp6 storage update owner or admin" ON storage.objects;
DROP POLICY IF EXISTS "pp6 storage update owner or admin" ON storage.objects;
CREATE POLICY "pp6 storage update owner or admin" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'pp6-files' AND (owner = auth.uid() OR public.is_admin_or_director()));

DROP POLICY IF EXISTS "pp6 storage delete admin only" ON storage.objects;
DROP POLICY IF EXISTS "pp6 storage delete admin only" ON storage.objects;
CREATE POLICY "pp6 storage delete admin only" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'pp6-files' AND public.has_role(auth.uid(),'admin'::app_role));

-- leave-attachments bucket: owner (folder = uid) or admin/director can read; admin can delete
DROP POLICY IF EXISTS "leave-attachments read owner or admin" ON storage.objects;
DROP POLICY IF EXISTS "leave-attachments read owner or admin" ON storage.objects;
CREATE POLICY "leave-attachments read owner or admin" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'leave-attachments'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin_or_director())
);

DROP POLICY IF EXISTS "leave-attachments delete admin" ON storage.objects;
DROP POLICY IF EXISTS "leave-attachments delete admin" ON storage.objects;
CREATE POLICY "leave-attachments delete admin" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'leave-attachments'
  AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'director'::app_role))
);
