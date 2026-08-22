-- Fix tenant isolation for core tables that already have school_id (from 20260423042237)
-- Replace overly-permissive USING(true) with school_id = get_user_school_id(auth.uid()) OR is_super_admin
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['students','personnel','classrooms','subjects','classroom_enrollments','student_scores','attendance','calendar_events','academic_events','library_books','bus_routes','wpa_assessments','eforms','notifications','homework','exam_submissions','health_measurements'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=tbl)
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name='school_id') THEN
      BEGIN
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_isolation_'||tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Auth users can view '||tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_isolation', tbl);
      EXCEPTION WHEN OTHERS THEN NULL; END;
      BEGIN
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (school_id = public.get_user_school_id(auth.uid()) OR public.is_super_admin(auth.uid()) OR school_id IS NULL) WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.is_super_admin(auth.uid()))', 'tenant_isolation_'||tbl, tbl);
      EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE NOTICE 'policy failed for %: %', tbl, SQLERRM; END;
    END IF;
  END LOOP;
END $$;

-- Add composite indexes for tenant-filtered queries (only if column exists)
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='students' AND column_name='school_id') THEN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_students_school_id ON public.students(school_id)'; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='personnel' AND column_name='school_id') THEN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_personnel_school_id ON public.personnel(school_id)'; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='attendance' AND column_name='school_id') THEN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON public.attendance(school_id, attendance_date) WHERE school_id IS NOT NULL'; END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student_scores' AND column_name='school_id') THEN EXECUTE 'CREATE INDEX IF NOT EXISTS idx_student_scores_school_term ON public.student_scores(school_id, semester) WHERE school_id IS NOT NULL'; END IF; END $$;
