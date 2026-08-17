-- Attendance: allow staff (admin/director/teacher) to manage; auth users to read
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attendance' AND policyname='Staff can view attendance') THEN
    CREATE POLICY "Staff can view attendance" ON public.attendance FOR SELECT
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attendance' AND policyname='Staff can insert attendance') THEN
    CREATE POLICY "Staff can insert attendance" ON public.attendance FOR INSERT
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attendance' AND policyname='Staff can update attendance') THEN
    CREATE POLICY "Staff can update attendance" ON public.attendance FOR UPDATE
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attendance' AND policyname='Staff can delete attendance') THEN
    CREATE POLICY "Staff can delete attendance" ON public.attendance FOR DELETE
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attendance' AND policyname='Students can view own attendance') THEN
    CREATE POLICY "Students can view own attendance" ON public.attendance FOR SELECT
      USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));
  END IF;
END $$;
-- Students: allow staff to view & manage
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='students' AND policyname='Staff can view all students') THEN
    CREATE POLICY "Staff can view all students" ON public.students FOR SELECT
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='students' AND policyname='Admin/Director can manage students') THEN
    CREATE POLICY "Admin/Director can manage students" ON public.students FOR ALL
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
  END IF;
END $$;
-- Classrooms: visible to all auth users; staff manages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='classrooms' AND policyname='Auth users can view classrooms') THEN
    CREATE POLICY "Auth users can view classrooms" ON public.classrooms FOR SELECT
      USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='classrooms' AND policyname='Staff can manage classrooms') THEN
    CREATE POLICY "Staff can manage classrooms" ON public.classrooms FOR ALL
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
      WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
  END IF;
END $$;
