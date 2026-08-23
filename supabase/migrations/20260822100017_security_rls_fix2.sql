-- Fix remaining USING(true) on sensitive tables not covered by 20260822100011
-- Also fix regression from 20260821182000 (bus/library/wpa) and warehouse
DO $$
DECLARE tbl text;
-- Tables still open per audit
tables text[] := ARRAY[
  'salary_records','budget_transactions','health_records','sdq_records','behavior_records','attendance','student_leaves',
  'assets','procurement_records','student_subsidies','id_plan_records','documents','student_scores',
  'bus_routes','bus_attendance','library_books','library_loans','wpa_assessments','asset_repairs',
  'dim_student','fact_attendance','fact_grades','fact_finance','backup_snapshots','kiosk_health_samples'
];
BEGIN
 FOREACH tbl IN ARRAY tables LOOP
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl) THEN
   BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_isolation_'||tbl, tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
   BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Auth users can manage '||tbl, tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
   BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Auth users manage '||tbl, tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
   BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'auth all '||tbl, tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
   BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'auth all bus_att', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
   BEGIN EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'auth all lib books', tbl); EXCEPTION WHEN OTHERS THEN NULL; END;
   -- Recreate with tenant check if has school_id, else role check
   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name='school_id') THEN
     BEGIN EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (school_id = public.get_user_school_id(auth.uid()) OR public.is_super_admin(auth.uid()) OR school_id IS NULL) WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.is_super_admin(auth.uid()))', 'tenant_isolation_'||tbl, tbl); EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE NOTICE 'policy % failed: %', tbl, SQLERRM; END;
   ELSE
     -- No school_id -> restrict to admin/director/teacher roles
     BEGIN EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''director'') OR public.has_role(auth.uid(), ''teacher'')) WITH CHECK (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''director'') OR public.has_role(auth.uid(), ''teacher''))', 'tenant_isolation_'||tbl, tbl); EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE NOTICE 'policy % failed: %', tbl, SQLERRM; END;
   END IF;
  END IF;
 END LOOP;
END $$;

-- Harden error_logs: remove anon insert, keep rate limit in app layer
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='error_logs') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anyone can insert errors" ON public.error_logs';
    EXECUTE 'CREATE POLICY "authenticated can insert errors" ON public.error_logs FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'error_logs policy fix failed: %', SQLERRM; END $$;
