DROP POLICY IF EXISTS "Recipients view eform attachments" ON public.eform_attachments;
CREATE POLICY "Recipients view eform attachments" ON public.eform_attachments FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM eform_recipients r WHERE r.eform_id = eform_attachments.eform_id AND r.recipient_id = auth.uid()));
DROP POLICY IF EXISTS "Sender can manage attachments" ON public.eform_attachments;
CREATE POLICY "Sender can manage attachments" ON public.eform_attachments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM eforms e WHERE e.id = eform_attachments.eform_id AND e.sender_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM eforms e WHERE e.id = eform_attachments.eform_id AND e.sender_id = auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can view iot readings" ON public.iot_readings;
CREATE POLICY "Authenticated users can view iot readings" ON public.iot_readings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Recipients view their documents" ON public.documents;
CREATE POLICY "Recipients view their documents" ON public.documents FOR SELECT TO authenticated USING (is_document_recipient(id, auth.uid()));
DROP POLICY IF EXISTS "Authenticated can view assets in same school" ON public.assets;
CREATE POLICY "Authenticated can view assets in same school" ON public.assets FOR SELECT TO authenticated USING (school_id = get_user_school_id(auth.uid()) OR is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "Authenticated view teacher_assignments" ON public.teacher_assignments;
CREATE POLICY "Authenticated view teacher_assignments" ON public.teacher_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Anyone authenticated can view subject_score_columns" ON public.subject_score_columns;
CREATE POLICY "Anyone authenticated can view subject_score_columns" ON public.subject_score_columns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated view subject_indicators" ON public.subject_indicators;
CREATE POLICY "Authenticated view subject_indicators" ON public.subject_indicators FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated read grading config" ON public.subject_grading_config;
CREATE POLICY "Authenticated read grading config" ON public.subject_grading_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth users view test scores in same school" ON public.school_test_scores;
CREATE POLICY "Auth users view test scores in same school" ON public.school_test_scores FOR SELECT TO authenticated USING (school_id = get_user_school_id(auth.uid()) OR is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "Auth users can view school_milk_records" ON public.school_milk_records;
CREATE POLICY "Auth users can view school_milk_records" ON public.school_milk_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth users can view school_lunch_records" ON public.school_lunch_records;
CREATE POLICY "Auth users can view school_lunch_records" ON public.school_lunch_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Devices viewable by authenticated" ON public.ict_devices;
CREATE POLICY "Devices viewable by authenticated" ON public.ict_devices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can view form templates" ON public.form_templates;
CREATE POLICY "Authenticated can view form templates" ON public.form_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Recipients can update own row" ON public.document_recipients;
CREATE POLICY "Recipients can update own row" ON public.document_recipients FOR UPDATE TO authenticated USING (recipient_user_id = auth.uid()) WITH CHECK (recipient_user_id = auth.uid());
DROP POLICY IF EXISTS "Homeroom teachers can view their students' chat logs" ON public.ai_chat_logs;
CREATE POLICY "Homeroom teachers can view their students' chat logs" ON public.ai_chat_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM students s JOIN classrooms c ON c.id = s.classroom_id
  WHERE s.auth_user_id = ai_chat_logs.user_id
    AND (c.homeroom_teacher_id IN (SELECT id FROM personnel WHERE user_id = auth.uid())
      OR c.homeroom_teacher_2_id IN (SELECT id FROM personnel WHERE user_id = auth.uid()))));
DROP POLICY IF EXISTS "Auth users can view action_plans" ON public.action_plans;
CREATE POLICY "Auth users can view action_plans" ON public.action_plans FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth users view academic events in same school" ON public.academic_events;
CREATE POLICY "Auth users view academic events in same school" ON public.academic_events FOR SELECT TO authenticated USING (school_id = get_user_school_id(auth.uid()) OR is_staff_user(auth.uid()));
GRANT SELECT ON public.iot_devices TO authenticated;
GRANT ALL ON public.iot_devices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eform_attachments TO authenticated;
GRANT ALL ON public.eform_attachments TO service_role;
GRANT SELECT ON public.iot_readings TO authenticated;

-- Seed current academic period (BE 2569) if missing
INSERT INTO public.academic_periods (academic_year_be, semester, start_date, end_date, is_current, is_closed)
SELECT 2569, 1, DATE '2026-05-16', DATE '2026-10-10', true, false
WHERE NOT EXISTS (SELECT 1 FROM public.academic_periods WHERE academic_year_be=2569 AND semester=1);
INSERT INTO public.academic_periods (academic_year_be, semester, start_date, end_date, is_current, is_closed)
SELECT 2569, 2, DATE '2026-11-01', DATE '2027-03-31', false, false
WHERE NOT EXISTS (SELECT 1 FROM public.academic_periods WHERE academic_year_be=2569 AND semester=2);
