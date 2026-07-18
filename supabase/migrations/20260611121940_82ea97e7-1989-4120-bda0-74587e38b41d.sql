
-- 1. Protect iot_devices credentials (api_token, base_url) from authenticated reads + Realtime
REVOKE SELECT (api_token, base_url, request_path, json_path) ON public.iot_devices FROM authenticated;
GRANT SELECT (id, name, description, device_type, icon, unit, source_type, entity_id,
              poll_interval_seconds, location, dashboard_group, display_order, is_active,
              last_value, last_value_numeric, last_status, last_error, last_fetched_at,
              meta, created_by, created_at, updated_at, system_category, color)
  ON public.iot_devices TO authenticated;

-- Restrict realtime broadcast to non-sensitive columns
ALTER PUBLICATION supabase_realtime DROP TABLE public.iot_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_devices
  (id, name, description, device_type, icon, unit, source_type, entity_id,
   poll_interval_seconds, location, dashboard_group, display_order, is_active,
   last_value, last_value_numeric, last_status, last_error, last_fetched_at,
   meta, created_by, created_at, updated_at, system_category, color);

-- 2. Protect ai_providers.api_key from authenticated reads
REVOKE SELECT (api_key) ON public.ai_providers FROM authenticated;

-- 3. hub_projects: don't expose rows with NULL school_id to unrelated users
DROP POLICY IF EXISTS "view projects in school" ON public.hub_projects;
CREATE POLICY "view projects in school" ON public.hub_projects
  FOR SELECT TO authenticated
  USING (
    school_id = get_user_school_id(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  );

-- 4. wall_post_reactions: scope to posts the user can already see
DROP POLICY IF EXISTS "reactions read" ON public.wall_post_reactions;
CREATE POLICY "reactions read" ON public.wall_post_reactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.wall_posts wp
      WHERE wp.id = wall_post_reactions.post_id
        AND (
          wp.visibility = 'public'
          OR (wp.visibility = ANY (ARRAY['school','public'])
              AND (wp.school_id IS NULL OR wp.school_id = get_user_school_id(auth.uid())))
          OR wp.author_id = auth.uid()
        )
    )
  );

-- 5. personnel: teachers should only see personnel within their own school
DROP POLICY IF EXISTS "Staff can view personnel" ON public.personnel;
CREATE POLICY "Staff can view personnel" ON public.personnel
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR user_id = auth.uid()
    OR (
      has_role(auth.uid(), 'teacher'::app_role)
      AND (
        school_id IS NULL
        OR get_user_school_id(auth.uid()) IS NULL
        OR school_id = get_user_school_id(auth.uid())
      )
    )
  );
