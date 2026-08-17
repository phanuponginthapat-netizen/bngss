-- 1. ai_chat_logs: remove homeroom teacher broad SELECT on private chat content
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Homeroom teachers can view their students'' chat logs" ON public.ai_chat_logs;

-- 2. kiosk_devices: restrict teacher SELECT to own devices only
DROP POLICY IF EXISTS "staff can view all devices" ON public.kiosk_devices;
DROP POLICY IF EXISTS "Admins directors view all devices; users view own" ON public.kiosk_devices;
DROP POLICY IF EXISTS "Admins directors view all devices; users view own" ON public.kiosk_devices;
CREATE POLICY "Admins directors view all devices; users view own"
ON public.kiosk_devices FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), ''admin''::app_role)
  OR has_role(auth.uid(), ''director''::app_role)
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "users can update own device row" ON public.kiosk_devices;
DROP POLICY IF EXISTS "Users update own device; admins any" ON public.kiosk_devices;
DROP POLICY IF EXISTS "Users update own device; admins any" ON public.kiosk_devices;
CREATE POLICY "Users update own device; admins any"
ON public.kiosk_devices FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), ''admin''::app_role)
  OR has_role(auth.uid(), ''director''::app_role)
)
WITH CHECK (
  user_id = auth.uid()
  OR has_role(auth.uid(), ''admin''::app_role)
  OR has_role(auth.uid(), ''director''::app_role)
);

-- 3. line_user_preferences: allow owner access via profiles.line_user_id mapping
DROP POLICY IF EXISTS "Service role only - line_user_preferences select" ON public.line_user_preferences;

DROP POLICY IF EXISTS "Owners view their line preferences" ON public.line_user_preferences;
DROP POLICY IF EXISTS "Owners view their line preferences" ON public.line_user_preferences;
CREATE POLICY "Owners view their line preferences"
ON public.line_user_preferences FOR SELECT
TO authenticated
USING (
  line_user_id IN (
    SELECT p.line_user_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.line_user_id IS NOT NULL
  )
  OR has_role(auth.uid(), ''admin''::app_role)
  OR has_role(auth.uid(), ''director''::app_role)
);

DROP POLICY IF EXISTS "Owners update their line preferences" ON public.line_user_preferences;
DROP POLICY IF EXISTS "Owners update their line preferences" ON public.line_user_preferences;
CREATE POLICY "Owners update their line preferences"
ON public.line_user_preferences FOR UPDATE
TO authenticated
USING (
  line_user_id IN (
    SELECT p.line_user_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.line_user_id IS NOT NULL
  )
)
WITH CHECK (
  line_user_id IN (
    SELECT p.line_user_id FROM public.profiles p
    WHERE p.id = auth.uid() AND p.line_user_id IS NOT NULL
  )
);

-- 4. personnel: teachers only see personnel in their explicit school (drop NULL fallback)
DROP POLICY IF EXISTS "Staff can view personnel" ON public.personnel;
DROP POLICY IF EXISTS "Staff can view personnel (scoped)" ON public.personnel;
DROP POLICY IF EXISTS "Staff can view personnel (scoped)" ON public.personnel;
CREATE POLICY "Staff can view personnel (scoped)"
ON public.personnel FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), ''admin''::app_role)
  OR has_role(auth.uid(), ''director''::app_role)
  OR user_id = auth.uid()
  OR (
    has_role(auth.uid(), ''teacher''::app_role)
    AND school_id IS NOT NULL
    AND school_id = get_user_school_id(auth.uid())
  )
);

-- 5. students: restrict homeroom teacher UPDATE to non-sensitive columns
DROP POLICY IF EXISTS "Homeroom teachers can update their students" ON public.students;

REVOKE UPDATE ON public.students FROM authenticated;
GRANT UPDATE (
  prefix, first_name, last_name, status,
  weight, height, photo_url,
  special_needs, is_special_needs, special_needs_type, inclusion_classroom_id
) ON public.students TO authenticated;
-- Admin/Director keep full UPDATE via their ALL policy (service_role has ALL)
GRANT UPDATE ON public.students TO service_role;

DROP POLICY IF EXISTS "Homeroom teachers update limited student fields" ON public.students;
DROP POLICY IF EXISTS "Homeroom teachers update limited student fields" ON public.students;
CREATE POLICY "Homeroom teachers update limited student fields"
ON public.students FOR UPDATE
TO authenticated
USING (is_homeroom_of_classroom(auth.uid(), classroom_id))
WITH CHECK (is_homeroom_of_classroom(auth.uid(), classroom_id))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
