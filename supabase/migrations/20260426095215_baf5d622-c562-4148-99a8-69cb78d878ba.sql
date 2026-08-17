
-- ============================================================
-- 1. AUTO-FILL school_id TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_fill_school_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only auto-fill if school_id is NULL and user is logged in
  IF NEW.school_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.school_id := public.get_user_school_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. ATTACH AUTO-FILL TRIGGER TO ALL school-scoped TABLES
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'students','personnel','classrooms','attendance','behavior_records',
    'health_records','home_visits','homeroom_records','homework_assignments',
    'enrollments','early_childhood_dev','documents','news_posts',
    'budget_transactions','assets','academic_events','account_balances',
    'action_plans','admissions'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_autofill_school_id ON public.%I;', t);
    EXECUTE format(
      'CREATE TRIGGER trg_autofill_school_id
       BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id();', t
    );
  END LOOP;
END $$;

-- ============================================================
-- 3. RLS SCHOOL-SCOPING for core tables
-- ============================================================

-- Helper: drop all policies on a table (so we can re-add cleanly)
-- We'll handle each table explicitly to keep control.

-- ----- students -----
DROP POLICY IF EXISTS "Auth users can view students" ON public.students;
DROP POLICY IF EXISTS "Staff can manage students" ON public.students;

DROP POLICY IF EXISTS "Super/Area admin view all students" ON public.students;
DROP POLICY IF EXISTS "Super/Area admin view all students" ON public.students;
CREATE POLICY "Super/Area admin view all students"
ON public.students FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

DROP POLICY IF EXISTS "School users view own school students" ON public.students;
DROP POLICY IF EXISTS "School users view own school students" ON public.students;
CREATE POLICY "School users view own school students"
ON public.students FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Staff manage own school students" ON public.students;
DROP POLICY IF EXISTS "Staff manage own school students" ON public.students;
CREATE POLICY "Staff manage own school students"
ON public.students FOR ALL TO authenticated
USING (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Super admin manage all students" ON public.students;
DROP POLICY IF EXISTS "Super admin manage all students" ON public.students;
CREATE POLICY "Super admin manage all students"
ON public.students FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ----- personnel -----
DROP POLICY IF EXISTS "Auth users can view personnel" ON public.personnel;
DROP POLICY IF EXISTS "Staff can manage personnel" ON public.personnel;

DROP POLICY IF EXISTS "Super/Area admin view all personnel" ON public.personnel;
DROP POLICY IF EXISTS "Super/Area admin view all personnel" ON public.personnel;
CREATE POLICY "Super/Area admin view all personnel"
ON public.personnel FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

DROP POLICY IF EXISTS "School users view own school personnel" ON public.personnel;
DROP POLICY IF EXISTS "School users view own school personnel" ON public.personnel;
CREATE POLICY "School users view own school personnel"
ON public.personnel FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Admin/Director manage own school personnel" ON public.personnel;
DROP POLICY IF EXISTS "Admin/Director manage own school personnel" ON public.personnel;
CREATE POLICY "Admin/Director manage own school personnel"
ON public.personnel FOR ALL TO authenticated
USING (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Super admin manage all personnel" ON public.personnel;
DROP POLICY IF EXISTS "Super admin manage all personnel" ON public.personnel;
CREATE POLICY "Super admin manage all personnel"
ON public.personnel FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ----- classrooms -----
DROP POLICY IF EXISTS "Auth users can view classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Staff can manage classrooms" ON public.classrooms;

DROP POLICY IF EXISTS "Super/Area admin view all classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Super/Area admin view all classrooms" ON public.classrooms;
CREATE POLICY "Super/Area admin view all classrooms"
ON public.classrooms FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

DROP POLICY IF EXISTS "School users view own classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "School users view own classrooms" ON public.classrooms;
CREATE POLICY "School users view own classrooms"
ON public.classrooms FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Staff manage own school classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Staff manage own school classrooms" ON public.classrooms;
CREATE POLICY "Staff manage own school classrooms"
ON public.classrooms FOR ALL TO authenticated
USING (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Super admin manage all classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Super admin manage all classrooms" ON public.classrooms;
CREATE POLICY "Super admin manage all classrooms"
ON public.classrooms FOR ALL TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ----- attendance -----
DROP POLICY IF EXISTS "Auth users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can manage attendance" ON public.attendance;

DROP POLICY IF EXISTS "Super/Area admin view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Super/Area admin view all attendance" ON public.attendance;
CREATE POLICY "Super/Area admin view all attendance"
ON public.attendance FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

DROP POLICY IF EXISTS "School staff view own school attendance" ON public.attendance;
DROP POLICY IF EXISTS "School staff view own school attendance" ON public.attendance;
CREATE POLICY "School staff view own school attendance"
ON public.attendance FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Staff manage own school attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff manage own school attendance" ON public.attendance;
CREATE POLICY "Staff manage own school attendance"
ON public.attendance FOR ALL TO authenticated
USING (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

-- ----- behavior_records -----
DROP POLICY IF EXISTS "Auth users can view behavior_records" ON public.behavior_records;
DROP POLICY IF EXISTS "Staff can manage behavior_records" ON public.behavior_records;

DROP POLICY IF EXISTS "Super/Area admin view all behavior" ON public.behavior_records;
DROP POLICY IF EXISTS "Super/Area admin view all behavior" ON public.behavior_records;
CREATE POLICY "Super/Area admin view all behavior"
ON public.behavior_records FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

DROP POLICY IF EXISTS "School staff view own school behavior" ON public.behavior_records;
DROP POLICY IF EXISTS "School staff view own school behavior" ON public.behavior_records;
CREATE POLICY "School staff view own school behavior"
ON public.behavior_records FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Staff manage own school behavior" ON public.behavior_records;
DROP POLICY IF EXISTS "Staff manage own school behavior" ON public.behavior_records;
CREATE POLICY "Staff manage own school behavior"
ON public.behavior_records FOR ALL TO authenticated
USING (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

-- ----- enrollments -----
DROP POLICY IF EXISTS "Auth users can view enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Staff can manage enrollments" ON public.enrollments;

DROP POLICY IF EXISTS "Super/Area admin view all enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Super/Area admin view all enrollments" ON public.enrollments;
CREATE POLICY "Super/Area admin view all enrollments"
ON public.enrollments FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

DROP POLICY IF EXISTS "School users view own school enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "School users view own school enrollments" ON public.enrollments;
CREATE POLICY "School users view own school enrollments"
ON public.enrollments FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Staff manage own school enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Staff manage own school enrollments" ON public.enrollments;
CREATE POLICY "Staff manage own school enrollments"
ON public.enrollments FOR ALL TO authenticated
USING (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

-- ----- documents -----
DROP POLICY IF EXISTS "Auth users can view documents" ON public.documents;
DROP POLICY IF EXISTS "Auth users can create documents" ON public.documents;
DROP POLICY IF EXISTS "Admin/Director can manage documents" ON public.documents;

DROP POLICY IF EXISTS "Super/Area admin view all documents" ON public.documents;
DROP POLICY IF EXISTS "Super/Area admin view all documents" ON public.documents;
CREATE POLICY "Super/Area admin view all documents"
ON public.documents FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

DROP POLICY IF EXISTS "School users view own school documents" ON public.documents;
DROP POLICY IF EXISTS "School users view own school documents" ON public.documents;
CREATE POLICY "School users view own school documents"
ON public.documents FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Auth users create documents in own school" ON public.documents;
DROP POLICY IF EXISTS "Auth users create documents in own school" ON public.documents;
CREATE POLICY "Auth users create documents in own school"
ON public.documents FOR INSERT TO authenticated
WITH CHECK (school_id IS NULL OR school_id = get_user_school_id(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin/Director manage own school documents" ON public.documents;
DROP POLICY IF EXISTS "Admin/Director manage own school documents" ON public.documents;
CREATE POLICY "Admin/Director manage own school documents"
ON public.documents FOR ALL TO authenticated
USING (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

-- ----- news_posts -----
DROP POLICY IF EXISTS "Auth users can view news_posts" ON public.news_posts;
DROP POLICY IF EXISTS "Admin/Director can manage news_posts" ON public.news_posts;

DROP POLICY IF EXISTS "Super/Area admin view all news" ON public.news_posts;
DROP POLICY IF EXISTS "Super/Area admin view all news" ON public.news_posts;
CREATE POLICY "Super/Area admin view all news"
ON public.news_posts FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

DROP POLICY IF EXISTS "School users view own school news" ON public.news_posts;
DROP POLICY IF EXISTS "School users view own school news" ON public.news_posts;
CREATE POLICY "School users view own school news"
ON public.news_posts FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Admin/Director manage own school news" ON public.news_posts;
DROP POLICY IF EXISTS "Admin/Director manage own school news" ON public.news_posts;
CREATE POLICY "Admin/Director manage own school news"
ON public.news_posts FOR ALL TO authenticated
USING (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

-- ----- budget_transactions -----
DROP POLICY IF EXISTS "Auth users can view budget_transactions" ON public.budget_transactions;
DROP POLICY IF EXISTS "Admin/Director can manage budget_transactions" ON public.budget_transactions;

DROP POLICY IF EXISTS "Super/Area admin view all budget" ON public.budget_transactions;
DROP POLICY IF EXISTS "Super/Area admin view all budget" ON public.budget_transactions;
CREATE POLICY "Super/Area admin view all budget"
ON public.budget_transactions FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

DROP POLICY IF EXISTS "School staff view own school budget" ON public.budget_transactions;
DROP POLICY IF EXISTS "School staff view own school budget" ON public.budget_transactions;
CREATE POLICY "School staff view own school budget"
ON public.budget_transactions FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Admin/Director manage own school budget" ON public.budget_transactions;
DROP POLICY IF EXISTS "Admin/Director manage own school budget" ON public.budget_transactions;
CREATE POLICY "Admin/Director manage own school budget"
ON public.budget_transactions FOR ALL TO authenticated
USING (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

-- ----- assets -----
DROP POLICY IF EXISTS "Auth users can view assets" ON public.assets;
DROP POLICY IF EXISTS "Admin/Director can manage assets" ON public.assets;

DROP POLICY IF EXISTS "Super/Area admin view all assets" ON public.assets;
DROP POLICY IF EXISTS "Super/Area admin view all assets" ON public.assets;
CREATE POLICY "Super/Area admin view all assets"
ON public.assets FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

DROP POLICY IF EXISTS "School users view own school assets" ON public.assets;
DROP POLICY IF EXISTS "School users view own school assets" ON public.assets;
CREATE POLICY "School users view own school assets"
ON public.assets FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Admin/Director manage own school assets" ON public.assets;
DROP POLICY IF EXISTS "Admin/Director manage own school assets" ON public.assets;
CREATE POLICY "Admin/Director manage own school assets"
ON public.assets FOR ALL TO authenticated
USING (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

-- ----- academic_events -----
DROP POLICY IF EXISTS "Auth users can view academic_events" ON public.academic_events;
DROP POLICY IF EXISTS "Admin/Director can manage academic_events" ON public.academic_events;

DROP POLICY IF EXISTS "Super/Area admin view all academic_events" ON public.academic_events;
DROP POLICY IF EXISTS "Super/Area admin view all academic_events" ON public.academic_events;
CREATE POLICY "Super/Area admin view all academic_events"
ON public.academic_events FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

DROP POLICY IF EXISTS "School users view own school academic_events" ON public.academic_events;
DROP POLICY IF EXISTS "School users view own school academic_events" ON public.academic_events;
CREATE POLICY "School users view own school academic_events"
ON public.academic_events FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "Admin/Director manage own school academic_events" ON public.academic_events;
DROP POLICY IF EXISTS "Admin/Director manage own school academic_events" ON public.academic_events;
CREATE POLICY "Admin/Director manage own school academic_events"
ON public.academic_events FOR ALL TO authenticated
USING (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
)
WITH CHECK (
  (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'school_admin'))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);
