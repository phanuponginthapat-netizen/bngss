-- read-only observer (ศน.) access to student scan report data
CREATE OR REPLACE FUNCTION public.is_observer(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'observer'::app_role);
$$;

CREATE POLICY "Observers view students" ON public.students FOR SELECT TO authenticated USING (public.is_observer(auth.uid()));
CREATE POLICY "Observers view attendance" ON public.attendance FOR SELECT TO authenticated USING (public.is_observer(auth.uid()));
CREATE POLICY "Observers view student leaves" ON public.student_leaves FOR SELECT TO authenticated USING (public.is_observer(auth.uid()));
CREATE POLICY "Observers view face scan logs" ON public.face_scan_logs FOR SELECT TO authenticated USING (public.is_observer(auth.uid()));
CREATE POLICY "Observers view classrooms" ON public.classrooms FOR SELECT TO authenticated USING (public.is_observer(auth.uid()));

-- parents need scan logs of their own children for the daily summary
CREATE POLICY "Parents view child scan logs" ON public.face_scan_logs FOR SELECT TO authenticated
USING (public.is_parent_of(auth.uid(), student_id));