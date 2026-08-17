-- 1. Personnel INSERT: restrict to admin/director only (was: any authenticated user)
DROP POLICY IF EXISTS "Users can insert their own personnel record" ON public.personnel;

DROP POLICY IF EXISTS "Admins manage personnel inserts" ON public.personnel;
CREATE POLICY "Admins manage personnel inserts"
ON public.personnel FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')
);

-- 2. face-photos bucket: restrict INSERT to staff roles only
DROP POLICY IF EXISTS "Auth users can upload face photos" ON storage.objects;

DROP POLICY IF EXISTS "Staff can upload face photos" ON storage.objects;
CREATE POLICY "Staff can upload face photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'face-photos' AND (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'director')
    OR public.has_role(auth.uid(),'teacher')
  )
);

-- 3. attendance-photos bucket: restrict INSERT to staff roles only
DROP POLICY IF EXISTS "Auth users can upload attendance photos" ON storage.objects;

DROP POLICY IF EXISTS "Staff can upload attendance photos" ON storage.objects;
CREATE POLICY "Staff can upload attendance photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attendance-photos' AND (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'director')
    OR public.has_role(auth.uid(),'teacher')
  )
);

-- 4. audit_logs: remove direct user INSERT; force via SECURITY DEFINER function
DROP POLICY IF EXISTS "Users insert own audit_logs" ON public.audit_logs;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _details jsonb DEFAULT NULL,
  _resource_type text DEFAULT NULL,
  _resource_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.audit_logs (user_id, action, details, resource_type, resource_id)
  VALUES (auth.uid(), _action, _details, _resource_type, _resource_id)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- 5. profiles: prevent users from clearing their own must_change_password
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users update own profile (preserve must_change_password)" ON public.profiles;
CREATE POLICY "Users update own profile (preserve must_change_password)"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND must_change_password IS NOT DISTINCT FROM (SELECT must_change_password FROM public.profiles WHERE id = auth.uid())
);

-- 6. home_visits: tighten homeroom teacher access to use personnel.user_id
-- (replace the name-string match with personnel-table identity match)
DROP POLICY IF EXISTS "Homeroom teacher manage home_visits" ON public.home_visits;

DROP POLICY IF EXISTS "Homeroom teacher manage home_visits (secure)" ON public.home_visits;
CREATE POLICY "Homeroom teacher manage home_visits (secure)"
ON public.home_visits FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.classrooms c ON c.id = s.classroom_id
    JOIN public.personnel p ON p.user_id = auth.uid()
    WHERE s.id = home_visits.student_id
      AND (
        c.homeroom_teacher = CONCAT(p.prefix, p.first_name, ' ', p.last_name)
        OR c.homeroom_teacher = CONCAT(p.first_name, ' ', p.last_name)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.classrooms c ON c.id = s.classroom_id
    JOIN public.personnel p ON p.user_id = auth.uid()
    WHERE s.id = home_visits.student_id
      AND (
        c.homeroom_teacher = CONCAT(p.prefix, p.first_name, ' ', p.last_name)
        OR c.homeroom_teacher = CONCAT(p.first_name, ' ', p.last_name)
      )
  )
);