
-- =====================================================================
-- 1. SECRET TABLES: block client SELECT, keep admin writes via meta views
-- =====================================================================

REVOKE SELECT ON public.app_secrets FROM anon, authenticated, PUBLIC;
REVOKE SELECT ON public.ai_providers FROM anon, authenticated, PUBLIC;
REVOKE SELECT ON public.ai_provider_keys FROM anon, authenticated, PUBLIC;
REVOKE SELECT ON public.google_chat_webhooks FROM anon, authenticated, PUBLIC;

GRANT INSERT, UPDATE, DELETE ON public.app_secrets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ai_providers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ai_provider_keys TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.google_chat_webhooks TO authenticated;

GRANT ALL ON public.app_secrets TO service_role;
GRANT ALL ON public.ai_providers TO service_role;
GRANT ALL ON public.ai_provider_keys TO service_role;
GRANT ALL ON public.google_chat_webhooks TO service_role;

GRANT SELECT ON public.app_secrets_meta TO authenticated;
GRANT SELECT ON public.ai_providers_meta TO authenticated;
GRANT SELECT ON public.ai_provider_keys_meta TO authenticated;
GRANT SELECT ON public.google_chat_webhooks_meta TO authenticated;

-- =====================================================================
-- 2. IOT DEVICES: hide api_token column from signed-in users
-- =====================================================================

REVOKE SELECT ON public.iot_devices FROM anon, authenticated, PUBLIC;

GRANT SELECT (
  id, name, description, device_type, icon, unit, source_type, base_url,
  entity_id, request_path, json_path, poll_interval_seconds, location,
  dashboard_group, display_order, is_active, last_value, last_value_numeric,
  last_status, last_error, last_fetched_at, meta, system_category, color,
  created_by, created_at, updated_at
) ON public.iot_devices TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.iot_devices TO authenticated;
GRANT ALL ON public.iot_devices TO service_role;

-- =====================================================================
-- 3. DISTRICT SNAPSHOTS: scope reads to user's school
-- =====================================================================

DROP POLICY IF EXISTS "Admins read snapshots of their school" ON public.district_snapshots;
CREATE POLICY "Admin/Director read own school snapshots"
ON public.district_snapshots
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
);

-- =====================================================================
-- 4. PROFILES: scope admin/director reads to same school
-- =====================================================================

DROP POLICY IF EXISTS "Admin and Director can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admin/Director view profiles in own school"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  AND (
    school_id IS NULL
    OR public.get_user_school_id(auth.uid()) IS NULL
    OR school_id = public.get_user_school_id(auth.uid())
  )
);

-- =====================================================================
-- 5. HOME VISITS: school-scoped restrictive
-- =====================================================================

DROP POLICY IF EXISTS "home_visits_school_scope" ON public.home_visits;
CREATE POLICY "home_visits_school_scope"
ON public.home_visits
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR school_id IS NULL
  OR public.get_user_school_id(auth.uid()) IS NULL
  OR school_id = public.get_user_school_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR school_id IS NULL
  OR public.get_user_school_id(auth.uid()) IS NULL
  OR school_id = public.get_user_school_id(auth.uid())
);

-- =====================================================================
-- 6. ERROR LOGS: tighten INSERT to require matching user_id
-- =====================================================================

DROP POLICY IF EXISTS "authenticated can insert errors" ON public.error_logs;
CREATE POLICY "authenticated insert own errors"
ON public.error_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- =====================================================================
-- 7. AUDIT LOGS: remove user self-insert
-- =====================================================================

DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.audit_logs;

-- =====================================================================
-- 8. FACE DESCRIPTORS: drop broad teacher read
-- =====================================================================

DROP POLICY IF EXISTS "Teachers can view face descriptors" ON public.student_face_descriptors;

-- =====================================================================
-- 9. PERSONNEL: hide email/phone from non-admin/director
-- =====================================================================

REVOKE SELECT ON public.personnel FROM anon, authenticated, PUBLIC;

GRANT SELECT (
  id, employee_code, prefix, first_name, last_name, position, department,
  status, hire_date, academic_standing, position_level, subject_group,
  user_id, school_id, created_at, updated_at
) ON public.personnel TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.personnel TO authenticated;
GRANT ALL ON public.personnel TO service_role;

CREATE OR REPLACE FUNCTION public.get_personnel_contact(_personnel_id uuid)
RETURNS TABLE(email text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.email, p.phone
  FROM public.personnel p
  WHERE p.id = _personnel_id
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'director'::app_role)
      OR p.user_id = auth.uid()
    );
$$;

REVOKE EXECUTE ON FUNCTION public.get_personnel_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_personnel_contact(uuid) TO authenticated;

-- =====================================================================
-- 10. SECURITY DEFINER hardening
-- =====================================================================

DO $$
DECLARE
  r record;
  internal_fns text[] := ARRAY[
    'add_points_on_deposit','auto_attendance_on_face_scan','auto_create_student_screening',
    'auto_create_substitute_on_leave_approval','auto_deduct_budget_on_procurement',
    'auto_enroll_students_on_assignment','auto_fill_school_id','auto_link_personnel_on_profile',
    'auto_link_student_on_profile','auto_map_schedule_teacher_on_personnel',
    'check_and_grant_badges','cleanup_expired_line_sessions','clear_classroom_on_graduation',
    'enforce_eform_recipient_role','fill_portfolio_school','fill_schedule_teacher_id',
    'fill_wall_school','finalize_past_substitute_teaching',
    'gchat_on_absence','gchat_on_behavior_any','gchat_on_damage_report','gchat_on_document',
    'gchat_on_eform','gchat_on_eform_recipient','gchat_on_emergency','gchat_on_face_scan',
    'gchat_on_garbage_badge','gchat_on_garbage_deposit','gchat_on_ict_loan','gchat_on_news',
    'gchat_on_score','gchat_on_serious_behavior','gchat_on_staff_leave','gchat_on_student_leave',
    'gchat_on_substitute','guard_must_change_password','handle_new_user',
    'hub_project_fill_school','lcb_fill_school','notify_google_chat','notify_homeroom_on_ai_risk',
    'notify_line_on_notification','notify_on_badge_earned','notify_on_damage_report',
    'notify_on_document_created','notify_on_eform_recipient','notify_on_emergency',
    'notify_on_face_scan','notify_on_garbage_deposit','notify_on_garbage_redemption',
    'notify_on_negative_behavior','notify_on_staff_leave','notify_on_student_leave',
    'notify_parents_on_absence','notify_parents_on_behavior','notify_parents_on_score',
    'notify_sender_on_document_reply','notify_sender_on_recipient_action',
    'notify_student_on_ict_loan','notify_users_on_news','notify_wall_post_comment',
    'notify_wall_post_reaction','prevent_duplicate_face_scan','prevent_self_student_code_change',
    'prevent_sensitive_profile_self_update','propagate_inbox_read_to_notification',
    'propagate_notification_read_to_inbox','recompute_eform_status','recompute_hub_project_totals',
    'send_line_to_student_parents','sync_classroom_homeroom_text','sync_face_scan_to_attendance',
    'sync_ict_device_status_on_loan','sync_notification_to_inbox','sync_personnel_to_profile',
    'sync_profile_to_personnel','sync_student_to_profile','sync_teacher_assignment_from_schedule',
    'trigger_push_notification','validate_schedules','wall_post_counters'
  ];
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(internal_fns)
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
        r.nspname, r.proname, r.args
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_app_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_secret(text) TO service_role;
