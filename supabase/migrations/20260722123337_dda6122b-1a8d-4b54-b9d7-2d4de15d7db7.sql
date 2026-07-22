
-- Generic auto-audit trigger function
CREATE OR REPLACE FUNCTION public.tg_auto_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_user_id UUID;
  v_user_name TEXT;
  v_user_role TEXT;
  v_target_id TEXT;
  v_details JSONB;
  v_old JSONB;
  v_new JSONB;
BEGIN
  v_user_id := auth.uid();
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new := to_jsonb(NEW);
    v_target_id := COALESCE((NEW).id::TEXT, '');
    v_details := jsonb_build_object('new', v_new);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_target_id := COALESCE((NEW).id::TEXT, '');
    -- Only include fields that actually changed
    v_details := jsonb_build_object(
      'changed', (
        SELECT jsonb_object_agg(key, jsonb_build_object('old', v_old->key, 'new', v_new->key))
        FROM jsonb_object_keys(v_new) key
        WHERE v_old->key IS DISTINCT FROM v_new->key
          AND key NOT IN ('updated_at','created_at')
      )
    );
    -- Skip if nothing meaningful changed
    IF v_details->'changed' IS NULL OR v_details->'changed' = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_old := to_jsonb(OLD);
    v_target_id := COALESCE((OLD).id::TEXT, '');
    v_details := jsonb_build_object('deleted', v_old);
  END IF;

  -- Best-effort user context (may be null for service_role)
  IF v_user_id IS NOT NULL THEN
    SELECT COALESCE(display_name, full_name, email) INTO v_user_name
    FROM public.profiles WHERE id = v_user_id LIMIT 1;
    SELECT role::TEXT INTO v_user_role
    FROM public.user_roles WHERE user_id = v_user_id LIMIT 1;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, user_name, user_role, action, target_table, target_id, details, created_at
  ) VALUES (
    v_user_id, v_user_name, v_user_role, v_action, TG_TABLE_NAME, v_target_id, v_details, now()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never break the underlying write on audit failure
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach to critical tables (drop & re-create to be idempotent)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'student_scores',
    'user_roles',
    'students',
    'personnel',
    'budget_transactions',
    'school_settings',
    'homework_assignments',
    'incomplete_grade_fix_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$I', t);
      EXECUTE format(
        'CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.tg_auto_audit()',
        t
      );
    END IF;
  END LOOP;
END $$;

-- Ensure the audit_logs table has helpful indexes for the viewer
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_table, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action, created_at DESC);
