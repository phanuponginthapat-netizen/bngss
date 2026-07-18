DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'add_points_on_deposit','auto_attendance_on_face_scan','auto_create_student_screening',
    'auto_create_substitute_on_leave_approval','auto_deduct_budget_on_procurement',
    'auto_enroll_students_on_assignment','auto_fill_school_id','auto_link_personnel_on_profile',
    'auto_link_student_on_profile','check_and_grant_badges','enforce_eform_recipient_role',
    'notify_line_on_notification','notify_on_badge_earned','notify_on_damage_report',
    'notify_on_document_created','notify_on_eform_recipient','notify_on_emergency',
    'notify_on_face_scan','notify_on_garbage_deposit','notify_on_negative_behavior',
    'notify_on_staff_leave','notify_on_student_leave','notify_parents_on_absence',
    'notify_parents_on_behavior','notify_parents_on_score','notify_sender_on_document_reply',
    'notify_sender_on_recipient_action','notify_student_on_ict_loan','notify_users_on_news',
    'prevent_duplicate_face_scan','process_redemption','recompute_eform_status',
    'sync_ict_device_status_on_loan','sync_notification_to_inbox','trigger_push_notification',
    'update_updated_at_column','handle_new_user','sync_gender_from_prefix','auto_compute_total_score'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I() FROM anon, authenticated, public', fn);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;