
-- 1. asset-photos storage: restrict read to staff
DROP POLICY IF EXISTS "Authenticated can read asset photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff read asset photos" ON storage.objects;
CREATE POLICY "Staff read asset photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'asset-photos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  )
);

-- 2. hub-projects storage: restrict read to staff
DROP POLICY IF EXISTS "hub-projects read auth" ON storage.objects;
DROP POLICY IF EXISTS "hub-projects read staff" ON storage.objects;
CREATE POLICY "hub-projects read staff"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'hub-projects'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  )
);

-- 3. game_hub_scores: scope reads
DROP POLICY IF EXISTS "scores_read_all_auth" ON public.game_hub_scores;
DROP POLICY IF EXISTS "scores_read_scoped" ON public.game_hub_scores;
CREATE POLICY "scores_read_scoped"
ON public.game_hub_scores FOR SELECT
USING (
  auth_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR is_parent_of(auth.uid(), student_id)
);

-- 4. iot_readings: staff only
DROP POLICY IF EXISTS "Authenticated users can view iot readings" ON public.iot_readings;
DROP POLICY IF EXISTS "Staff can view iot readings" ON public.iot_readings;
CREATE POLICY "Staff can view iot readings"
ON public.iot_readings FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

-- 5. print_templates: only shared/active with role match
DROP POLICY IF EXISTS "Anyone authenticated can read active templates" ON public.print_templates;
DROP POLICY IF EXISTS "Active templates readable by shared roles" ON public.print_templates;
CREATE POLICY "Active templates readable by shared roles"
ON public.print_templates FOR SELECT
USING (
  is_active = true
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text = ANY (COALESCE(print_templates.shared_with_roles, ARRAY[]::text[]))
    )
  )
);

-- 6. school_milk_records / school_lunch_records: same-school staff only
DROP POLICY IF EXISTS "Auth users can view school_milk_records" ON public.school_milk_records;
DROP POLICY IF EXISTS "Same-school staff view school_milk_records" ON public.school_milk_records;
CREATE POLICY "Same-school staff view school_milk_records"
ON public.school_milk_records FOR SELECT
USING (
  (has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Auth users can view school_lunch_records" ON public.school_lunch_records;
DROP POLICY IF EXISTS "Same-school staff view school_lunch_records" ON public.school_lunch_records;
CREATE POLICY "Same-school staff view school_lunch_records"
ON public.school_lunch_records FOR SELECT
USING (
  (has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

-- 7. school_test_scores: admin/director OR same-school staff
DROP POLICY IF EXISTS "Auth users view test scores" ON public.school_test_scores;
DROP POLICY IF EXISTS "Same-school staff view test scores" ON public.school_test_scores;
CREATE POLICY "Same-school staff view test scores"
ON public.school_test_scores FOR SELECT
USING (
  (has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

-- 8. academic_events: scope to same school (or NULL for global system events restricted to staff)
DROP POLICY IF EXISTS "Auth users view academic events" ON public.academic_events;
DROP POLICY IF EXISTS "Same-school users view academic events" ON public.academic_events;
CREATE POLICY "Same-school users view academic events"
ON public.academic_events FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    school_id = get_user_school_id(auth.uid())
    OR (school_id IS NULL AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'director'::app_role)
      OR has_role(auth.uid(), 'teacher'::app_role)
    ))
  )
);

-- 9. admissions: require non-null school_id for future rows, tighten policies
-- Enforce non-null via trigger (avoid failing on existing rows)
UPDATE public.admissions
   SET school_id = (SELECT id FROM public.schools ORDER BY created_at LIMIT 1)
 WHERE school_id IS NULL;

CREATE OR REPLACE FUNCTION public.admissions_require_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.school_id IS NULL THEN
    NEW.school_id := get_user_school_id(auth.uid());
  END IF;
  IF NEW.school_id IS NULL THEN
    RAISE EXCEPTION 'admissions.school_id is required';
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS admissions_require_school_id_trg ON public.admissions;
CREATE TRIGGER admissions_require_school_id_trg
BEFORE INSERT OR UPDATE ON public.admissions
FOR EACH ROW EXECUTE FUNCTION public.admissions_require_school_id();

DROP POLICY IF EXISTS "Admin/Director can view admissions" ON public.admissions;
DROP POLICY IF EXISTS "Admin/Director view admissions (same school)" ON public.admissions;
CREATE POLICY "Admin/Director view admissions (same school)"
ON public.admissions FOR SELECT
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  AND school_id IS NOT NULL
  AND school_id = get_user_school_id(auth.uid())
);

DROP POLICY IF EXISTS "Admin/Director can manage admissions" ON public.admissions;
DROP POLICY IF EXISTS "Admin/Director manage admissions (same school)" ON public.admissions;
CREATE POLICY "Admin/Director manage admissions (same school)"
ON public.admissions FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  AND school_id IS NOT NULL
  AND school_id = get_user_school_id(auth.uid())
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  AND school_id IS NOT NULL
  AND school_id = get_user_school_id(auth.uid())
);

-- 10. cms_settings anon policy: switch to explicit deny of any sensitive-looking key
DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings;
CREATE POLICY "Anon view public cms keys"
ON public.cms_settings FOR SELECT
TO anon
USING (
  key !~* '(password|secret|token|api[_-]?key|private|credential|webhook|internal|admin|service[_-]?role|jwt|bearer|auth|salt|hash|pin|otp|smtp|line[_-]?channel|refresh)'
  AND key NOT ILIKE 'id_card%'
  AND key NOT ILIKE '%template%'
  AND key NOT ILIKE '%_key'
  AND key NOT ILIKE '%_token%'
);

-- 11. SECURITY DEFINER function EXECUTE hardening
-- Revoke EXECUTE from PUBLIC, anon, authenticated on ALL SECURITY DEFINER trigger functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname = 'public'
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
  END LOOP;
END $$;

-- For non-trigger SECURITY DEFINER: revoke anon by default, keep authenticated;
-- then re-grant anon for the small allowlist of truly public RPCs.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname = 'public'
      AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    BEGIN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Allowlist: public/anon-callable RPCs used by public pages
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'get_public_profile',
        'search_public_profiles',
        'get_public_org_chart',
        'find_profile_id_by_code',
        'app_base_url',
        'get_available_academic_years',
        'get_profiles_public'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', r.sig);
  END LOOP;
END $$;
