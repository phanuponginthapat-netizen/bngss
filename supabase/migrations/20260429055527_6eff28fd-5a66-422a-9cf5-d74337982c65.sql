-- STORAGE
UPDATE storage.buckets SET public = false WHERE id IN ('face-photos','home-visit-photos','pa-files','pp6-files');

DROP POLICY IF EXISTS "Anyone can view face photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view home visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view pp6 files" ON storage.objects;
DROP POLICY IF EXISTS "PA files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete pp6 files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete PA files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete face photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update face photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete home visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update PA files" ON storage.objects;

CREATE POLICY "Staff can view face photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='face-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "Staff can update face photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='face-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "Staff can delete face photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='face-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

CREATE POLICY "Staff can view home visit photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='home-visit-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "Staff can delete home visit photos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='home-visit-photos' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

CREATE POLICY "Staff and owner view PA files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='pa-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR (storage.foldername(name))[1] = auth.uid()::text));
CREATE POLICY "Staff update PA files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='pa-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR (storage.foldername(name))[1] = auth.uid()::text));
CREATE POLICY "Admin delete PA files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='pa-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

CREATE POLICY "Staff view pp6 files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='pp6-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "Admin delete pp6 files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id='pp6-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

-- TABLES
DROP POLICY IF EXISTS "Auth users manage student_screenings" ON public.student_screenings;
CREATE POLICY "Staff manage student_screenings" ON public.student_screenings FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

DROP POLICY IF EXISTS "Auth users manage vaccine_records" ON public.vaccine_records;
CREATE POLICY "Staff manage vaccine_records" ON public.vaccine_records FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Students view own vaccines" ON public.vaccine_records FOR SELECT TO authenticated
USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));
CREATE POLICY "Parents view child vaccines" ON public.vaccine_records FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'parent') AND student_id IN (SELECT student_id FROM public.parent_student_links WHERE parent_user_id = auth.uid()));

DROP POLICY IF EXISTS "Auth users manage time_clock" ON public.time_clock;
CREATE POLICY "Personnel manage own time_clock" ON public.time_clock FOR ALL TO authenticated
USING (personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()))
WITH CHECK (personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()));
CREATE POLICY "Students manage own time_clock" ON public.time_clock FOR ALL TO authenticated
USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()))
WITH CHECK (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));
CREATE POLICY "Staff manage all time_clock" ON public.time_clock FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

DROP POLICY IF EXISTS "Auth users manage teacher_assignments" ON public.teacher_assignments;
CREATE POLICY "Staff manage teacher_assignments" ON public.teacher_assignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Authenticated view teacher_assignments" ON public.teacher_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth users manage subject_indicators" ON public.subject_indicators;
CREATE POLICY "Staff manage subject_indicators" ON public.subject_indicators FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "Authenticated view subject_indicators" ON public.subject_indicators FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth users manage substitute_teaching" ON public.substitute_teaching;
CREATE POLICY "Staff manage substitute_teaching" ON public.substitute_teaching FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

CREATE POLICY "Authenticated view personnel basic" ON public.personnel FOR SELECT TO authenticated USING (true);

CREATE POLICY "Recipients view eform attachments" ON public.eform_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.eform_recipients r WHERE r.eform_id = eform_attachments.eform_id AND r.recipient_id = auth.uid()));