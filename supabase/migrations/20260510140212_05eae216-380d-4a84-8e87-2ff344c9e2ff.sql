-- Revoke EXECUTE from anon/authenticated/PUBLIC on trigger-only helpers
DO $$
DECLARE
  fn TEXT;
  trigger_only TEXT[] := ARRAY[
    'handle_new_user','auto_link_personnel_on_profile','auto_link_student_on_profile',
    'auto_fill_school_id','auto_create_student_screening','auto_compute_total_score',
    'auto_enroll_students_on_assignment','auto_deduct_budget_on_procurement',
    'auto_create_substitute_on_leave_approval',
    'notify_on_emergency','notify_on_damage_report','notify_on_eform_recipient',
    'notify_on_negative_behavior','notify_users_on_news','notify_on_document_created',
    'notify_on_badge_earned','notify_on_garbage_deposit','notify_sender_on_document_reply',
    'notify_parents_on_absence','notify_on_student_leave','notify_sender_on_recipient_action',
    'notify_line_on_notification','notify_on_staff_leave',
    'sync_notification_to_inbox','recompute_eform_status','process_redemption',
    'add_points_on_deposit','check_and_grant_badges','trigger_push_notification',
    'update_updated_at_column'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_only LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;