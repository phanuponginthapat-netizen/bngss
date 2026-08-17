
-- ============================================================
-- SPIDER-WEB: Add missing FK constraints with proper cascade rules
-- ============================================================

-- ---- STUDENTS as parent ----
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_classroom_fk;
ALTER TABLE public.students
  ADD CONSTRAINT students_classroom_fk FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;

ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_fk;
ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_student_fk  FOREIGN KEY (student_id) REFERENCES public.students(id)  ON DELETE CASCADE,
  ADD CONSTRAINT attendance_subject_fk  FOREIGN KEY (subject_id) REFERENCES public.subjects(id)  ON DELETE SET NULL;

ALTER TABLE public.face_scan_logs DROP CONSTRAINT IF EXISTS face_scan_student_fk;
ALTER TABLE public.face_scan_logs
  ADD CONSTRAINT face_scan_student_fk   FOREIGN KEY (student_id) REFERENCES public.students(id)  ON DELETE CASCADE;

ALTER TABLE public.behavior_records DROP CONSTRAINT IF EXISTS behavior_student_fk;
ALTER TABLE public.behavior_records
  ADD CONSTRAINT behavior_student_fk    FOREIGN KEY (student_id) REFERENCES public.students(id)  ON DELETE CASCADE;

ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enroll_student_fk;
ALTER TABLE public.enrollments
  ADD CONSTRAINT enroll_student_fk      FOREIGN KEY (student_id)   REFERENCES public.students(id)   ON DELETE CASCADE,
  ADD CONSTRAINT enroll_subject_fk      FOREIGN KEY (subject_id)   REFERENCES public.subjects(id)   ON DELETE CASCADE,
  ADD CONSTRAINT enroll_classroom_fk    FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;

ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_student_fk;
ALTER TABLE public.health_records
  ADD CONSTRAINT health_student_fk      FOREIGN KEY (student_id) REFERENCES public.students(id)  ON DELETE CASCADE;

ALTER TABLE public.home_visits DROP CONSTRAINT IF EXISTS visit_student_fk;
ALTER TABLE public.home_visits
  ADD CONSTRAINT visit_student_fk       FOREIGN KEY (student_id)   REFERENCES public.students(id)   ON DELETE CASCADE,
  ADD CONSTRAINT visit_classroom_fk     FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;

ALTER TABLE public.homeroom_records DROP CONSTRAINT IF EXISTS homeroom_student_fk;
ALTER TABLE public.homeroom_records
  ADD CONSTRAINT homeroom_student_fk    FOREIGN KEY (student_id)   REFERENCES public.students(id)   ON DELETE CASCADE,
  ADD CONSTRAINT homeroom_classroom_fk  FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;

ALTER TABLE public.parent_student_links DROP CONSTRAINT IF EXISTS parent_link_student_fk;
ALTER TABLE public.parent_student_links
  ADD CONSTRAINT parent_link_student_fk FOREIGN KEY (student_id)  REFERENCES public.students(id)  ON DELETE CASCADE,
  ADD CONSTRAINT parent_link_user_fk    FOREIGN KEY (parent_user_id) REFERENCES auth.users(id)    ON DELETE CASCADE;

ALTER TABLE public.early_childhood_dev DROP CONSTRAINT IF EXISTS ec_student_fk;
ALTER TABLE public.early_childhood_dev
  ADD CONSTRAINT ec_student_fk          FOREIGN KEY (student_id) REFERENCES public.students(id)  ON DELETE CASCADE;

-- ---- CLASSROOM / SUBJECT ----
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS sched_subject_fk;
ALTER TABLE public.schedules
  ADD CONSTRAINT sched_subject_fk   FOREIGN KEY (subject_id)   REFERENCES public.subjects(id)   ON DELETE CASCADE,
  ADD CONSTRAINT sched_classroom_fk FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;

ALTER TABLE public.homework_assignments DROP CONSTRAINT IF EXISTS hw_subject_fk;
ALTER TABLE public.homework_assignments
  ADD CONSTRAINT hw_subject_fk    FOREIGN KEY (subject_id)   REFERENCES public.subjects(id)   ON DELETE CASCADE,
  ADD CONSTRAINT hw_classroom_fk  FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;

-- ---- E-FORM ----
ALTER TABLE public.eform_recipients DROP CONSTRAINT IF EXISTS eform_rcpt_eform_fk;
ALTER TABLE public.eform_recipients
  ADD CONSTRAINT eform_rcpt_eform_fk FOREIGN KEY (eform_id) REFERENCES public.eforms(id) ON DELETE CASCADE,
  ADD CONSTRAINT eform_rcpt_user_fk  FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.eform_attachments DROP CONSTRAINT IF EXISTS eform_att_eform_fk;
ALTER TABLE public.eform_attachments
  ADD CONSTRAINT eform_att_eform_fk  FOREIGN KEY (eform_id) REFERENCES public.eforms(id) ON DELETE CASCADE;

ALTER TABLE public.eforms DROP CONSTRAINT IF EXISTS eform_sender_fk;
ALTER TABLE public.eforms
  ADD CONSTRAINT eform_sender_fk     FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---- DOCUMENTS ----
ALTER TABLE public.document_recipients DROP CONSTRAINT IF EXISTS doc_rcpt_doc_fk;
ALTER TABLE public.document_recipients
  ADD CONSTRAINT doc_rcpt_doc_fk  FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE,
  ADD CONSTRAINT doc_rcpt_user_fk FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---- PERSONNEL ----
ALTER TABLE public.personnel DROP CONSTRAINT IF EXISTS personnel_user_fk;
ALTER TABLE public.personnel
  ADD CONSTRAINT personnel_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.pa_agreements DROP CONSTRAINT IF EXISTS pa_personnel_fk;
ALTER TABLE public.pa_agreements
  ADD CONSTRAINT pa_personnel_fk   FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;

ALTER TABLE public.pa_indicator_scores DROP CONSTRAINT IF EXISTS pa_score_agreement_fk;
ALTER TABLE public.pa_indicator_scores
  ADD CONSTRAINT pa_score_agreement_fk FOREIGN KEY (pa_agreement_id) REFERENCES public.pa_agreements(id) ON DELETE CASCADE;

ALTER TABLE public.salary_records DROP CONSTRAINT IF EXISTS salary_personnel_fk;
ALTER TABLE public.salary_records
  ADD CONSTRAINT salary_personnel_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;

ALTER TABLE public.id_plan_records DROP CONSTRAINT IF EXISTS idplan_personnel_fk;
ALTER TABLE public.id_plan_records
  ADD CONSTRAINT idplan_personnel_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;

ALTER TABLE public.personnel_assessments DROP CONSTRAINT IF EXISTS pers_assess_user_fk;
ALTER TABLE public.personnel_assessments
  ADD CONSTRAINT pers_assess_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---- ASSETS / ICT ----
ALTER TABLE public.asset_damage_reports DROP CONSTRAINT IF EXISTS damage_asset_fk;
ALTER TABLE public.asset_damage_reports
  ADD CONSTRAINT damage_asset_fk    FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE,
  ADD CONSTRAINT damage_reporter_fk FOREIGN KEY (reported_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.ict_loans DROP CONSTRAINT IF EXISTS loan_device_fk;
ALTER TABLE public.ict_loans
  ADD CONSTRAINT loan_device_fk    FOREIGN KEY (device_id)    REFERENCES public.ict_devices(id) ON DELETE CASCADE,
  ADD CONSTRAINT loan_student_fk   FOREIGN KEY (student_id)   REFERENCES public.students(id)    ON DELETE SET NULL,
  ADD CONSTRAINT loan_personnel_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id)   ON DELETE SET NULL;

-- ---- IoT ----
ALTER TABLE public.iot_readings DROP CONSTRAINT IF EXISTS iot_read_device_fk;
ALTER TABLE public.iot_readings
  ADD CONSTRAINT iot_read_device_fk FOREIGN KEY (device_id) REFERENCES public.iot_devices(id) ON DELETE CASCADE;

-- ---- GARBAGE BANK ----
ALTER TABLE public.garbage_deposits DROP CONSTRAINT IF EXISTS gd_student_fk;
ALTER TABLE public.garbage_deposits
  ADD CONSTRAINT gd_student_fk   FOREIGN KEY (student_id)   REFERENCES public.students(id)  ON DELETE CASCADE,
  ADD CONSTRAINT gd_personnel_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;

ALTER TABLE public.garbage_student_points DROP CONSTRAINT IF EXISTS gsp_student_fk;
ALTER TABLE public.garbage_student_points
  ADD CONSTRAINT gsp_student_fk FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.garbage_personnel_points DROP CONSTRAINT IF EXISTS gpp_personnel_fk;
ALTER TABLE public.garbage_personnel_points
  ADD CONSTRAINT gpp_personnel_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;

ALTER TABLE public.garbage_redemptions DROP CONSTRAINT IF EXISTS gr_student_fk;
ALTER TABLE public.garbage_redemptions
  ADD CONSTRAINT gr_student_fk   FOREIGN KEY (student_id)   REFERENCES public.students(id)  ON DELETE CASCADE,
  ADD CONSTRAINT gr_personnel_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;

ALTER TABLE public.garbage_user_badges DROP CONSTRAINT IF EXISTS gub_student_fk;
ALTER TABLE public.garbage_user_badges
  ADD CONSTRAINT gub_student_fk   FOREIGN KEY (student_id)   REFERENCES public.students(id)  ON DELETE CASCADE,
  ADD CONSTRAINT gub_personnel_fk FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;

-- ---- USER-SCOPED TABLES (cleanup when auth user deleted) ----
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notif_user_fk;
ALTER TABLE public.notifications
  ADD CONSTRAINT notif_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.inbox_items DROP CONSTRAINT IF EXISTS inbox_user_fk;
ALTER TABLE public.inbox_items
  ADD CONSTRAINT inbox_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_user_fk;
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_user_fk  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.pdpa_consents DROP CONSTRAINT IF EXISTS pdpa_user_fk;
ALTER TABLE public.pdpa_consents
  ADD CONSTRAINT pdpa_user_fk  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_dashboard_widgets DROP CONSTRAINT IF EXISTS dashw_user_fk;
ALTER TABLE public.user_dashboard_widgets
  ADD CONSTRAINT dashw_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- PREVENT DUPLICATE ATTENDANCE (assembly + per-period)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_per_day_subject
  ON public.attendance (student_id, attendance_date, COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'::uuid));
