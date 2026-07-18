
-- 1) Trigger: block non-admin self-update of privileged linking fields
CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN NEW; END IF;

  IF NEW.student_code IS DISTINCT FROM OLD.student_code THEN
    RAISE EXCEPTION 'Only admins can change student_code';
  END IF;
  IF NEW.line_user_id IS DISTINCT FROM OLD.line_user_id THEN
    RAISE EXCEPTION 'Only admins can change line_user_id';
  END IF;
  IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN
    RAISE EXCEPTION 'Only admins can change school_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_privileged_profile_self_update ON public.profiles;
CREATE TRIGGER trg_prevent_privileged_profile_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_profile_self_update();

-- 2) Parent linkage via explicit columns
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS parent_user_id uuid,
  ADD COLUMN IF NOT EXISTS parent_user_id_2 uuid;

UPDATE public.students s
SET parent_user_id = p.id
FROM public.profiles p
WHERE s.parent_user_id IS NULL
  AND p.student_code IS NOT NULL
  AND p.student_code <> ''
  AND p.student_code = s.student_code
  AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'parent'::app_role);

CREATE OR REPLACE FUNCTION public.is_parent_of(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = _student_id
      AND (s.parent_user_id = _user_id OR s.parent_user_id_2 = _user_id)
      AND public.has_role(_user_id, 'parent'::app_role)
  );
$$;

-- 3) Lock AI provider api_key columns to service_role only; provide masked views
REVOKE SELECT ON public.ai_provider_keys FROM anon, authenticated;
REVOKE SELECT ON public.ai_providers    FROM anon, authenticated;

CREATE OR REPLACE VIEW public.ai_provider_keys_safe AS
SELECT id, provider_type, label, status, used_today, used_total, daily_limit,
       cooldown_until, last_used_at, last_error, last_reset_date, priority,
       created_at, updated_at,
       CASE WHEN api_key IS NULL OR api_key = '' THEN NULL
            ELSE '***' || RIGHT(api_key, 4) END AS api_key_masked
FROM public.ai_provider_keys;

CREATE OR REPLACE VIEW public.ai_providers_safe AS
SELECT id, name, provider_type, base_url, model, priority, enabled,
       supports_vision, supports_json, monthly_call_limit, extra_headers, notes,
       created_at, updated_at,
       CASE WHEN api_key IS NULL OR api_key = '' THEN NULL
            ELSE '***' || RIGHT(api_key, 4) END AS api_key_masked
FROM public.ai_providers;

GRANT SELECT ON public.ai_provider_keys_safe TO authenticated;
GRANT SELECT ON public.ai_providers_safe TO authenticated;

-- 4) Storage buckets: pdf-templates & worksheet-files require auth
DROP POLICY IF EXISTS "public read pdf-templates" ON storage.objects;
CREATE POLICY "authenticated read pdf-templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pdf-templates');

DROP POLICY IF EXISTS "wsf_public_read" ON storage.objects;
CREATE POLICY "wsf_authenticated_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'worksheet-files');
