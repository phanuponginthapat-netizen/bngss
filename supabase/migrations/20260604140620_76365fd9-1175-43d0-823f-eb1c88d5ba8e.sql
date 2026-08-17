-- 1) error_logs: ต้อง login ก่อนจึงจะ insert ได้
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "anyone can insert errors" ON public.error_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "authenticated can insert errors" ON public.error_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "authenticated can insert errors" ON public.error_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "authenticated can insert errors"
  ON public.error_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) Revoke EXECUTE จากฟังก์ชันภายในที่ไม่ควรเรียกผ่าน Data API
DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    -- Trigger functions
    'add_points_on_deposit','app_base_url','archive_and_purge_old_data','archive_old_data',
    'auto_attendance_on_face_scan','auto_create_student_screening','auto_create_substitute_on_leave_approval',
    'auto_deduct_budget_on_procurement','auto_enroll_students_on_assignment','auto_fill_school_id',
    'auto_link_personnel_on_profile','auto_link_student_on_profile','auto_map_schedule_teacher_on_personnel',
    'check_and_grant_badges','cleanup_expired_line_sessions','enforce_eform_recipient_role',
    'fill_schedule_teacher_id','handle_new_user','notify_line_on_notification',
    'notify_on_badge_earned','notify_on_damage_report','notify_on_document_created',
    'notify_on_eform_recipient','notify_on_emergency','notify_on_garbage_deposit',
    'notify_on_student_leave','notify_parents_on_absence','notify_parents_on_score',
    'notify_sender_on_document_reply','notify_sender_on_recipient_action','notify_student_on_ict_loan',
    'notify_users_on_news','process_redemption','recompute_eform_status',
    'send_line_to_student_parents','sync_classroom_homeroom_text','sync_face_scan_to_attendance',
    'update_updated_at_column','validate_schedules','auto_compute_total_score',
    'clear_classroom_on_graduation','notify_google_chat',
    -- Google Chat triggers
    'gchat_on_absence','gchat_on_behavior_any','gchat_on_damage_report','gchat_on_document',
    'gchat_on_eform','gchat_on_eform_recipient','gchat_on_emergency','gchat_on_face_scan',
    'gchat_on_garbage_badge','gchat_on_garbage_deposit','gchat_on_ict_loan','gchat_on_news',
    'gchat_on_score','gchat_on_serious_behavior','gchat_on_staff_leave','gchat_on_student_leave',
    'gchat_on_substitute',
    -- Admin-only utilities (เรียกผ่าน edge function / service role เท่านั้น)
    'get_app_secret','get_cloud_usage_summary','get_available_academic_years'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function OR ambiguous_function THEN
      -- ข้ามถ้าไม่มี หรือมี overload หลายตัว (จัดการแยกถ้าจำเป็น)
      NULL;
    END;
  END LOOP;

  -- ฟังก์ชันที่มี argument list ชัดเจน
  BEGIN EXECUTE 'REVOKE ALL ON FUNCTION public.archive_and_purge_old_data(integer) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN EXECUTE 'REVOKE ALL ON FUNCTION public.validate_schedules(integer, integer) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN EXECUTE 'REVOKE ALL ON FUNCTION public.get_app_secret(text) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN EXECUTE 'REVOKE ALL ON FUNCTION public.notify_google_chat(text, text, text, text, text, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN EXECUTE 'REVOKE ALL ON FUNCTION public.send_line_to_student_parents(uuid, text, text) FROM PUBLIC, anon, authenticated'; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
