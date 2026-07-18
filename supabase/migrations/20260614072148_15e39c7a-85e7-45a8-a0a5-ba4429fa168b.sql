-- Revoke internal/trigger SECURITY DEFINER funcs from PUBLIC
DO $$
DECLARE r record;
  internal_names text[] := ARRAY[
    'ensure_default_app_secrets','fill_portfolio_school','fill_wall_school',
    'hub_project_fill_school','lcb_fill_school','finalize_past_substitute_teaching',
    'guard_must_change_password','notify_on_garbage_redemption',
    'notify_wall_post_comment','notify_wall_post_reaction',
    'prevent_self_student_code_change','prevent_sensitive_profile_self_update',
    'propagate_inbox_read_to_notification','propagate_notification_read_to_inbox',
    'recompute_hub_project_totals','send_line_to_student_parents',
    'sync_personnel_to_profile','sync_profile_to_personnel','sync_student_to_profile',
    'wall_post_counters'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname = ANY(internal_names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated', r.proname, r.args);
  END LOOP;
END $$;

-- RLS helpers: authenticated only
REVOKE EXECUTE ON FUNCTION public.can_access_eform_attachment(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_upload_eform_attachment(text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_access_eform_attachment(uuid, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.can_upload_eform_attachment(text, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.student_in_user_school(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.student_in_user_school(uuid) TO authenticated;

-- Re-affirm public RPCs (anon + authenticated)
GRANT EXECUTE ON FUNCTION public.find_profile_id_by_code(text)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_org_chart()             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_personnel_avatars(uuid[])      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_profiles()               TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_profiles(text)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_school_members()              TO anon, authenticated;
