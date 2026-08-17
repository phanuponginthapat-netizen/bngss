-- 1. asset_damage_reports
DROP POLICY IF EXISTS "Auth users can create damage reports" ON public.asset_damage_reports;
DROP POLICY IF EXISTS "Users create own damage reports" ON public.asset_damage_reports;
DROP POLICY IF EXISTS "Users create own damage reports" ON public.asset_damage_reports;
CREATE POLICY "Users create own damage reports"
  ON public.asset_damage_reports FOR INSERT TO authenticated
  WITH CHECK (
    reported_by_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  );

-- 2. document_recipients
DROP POLICY IF EXISTS "Auth users can create document_recipients" ON public.document_recipients;
DROP POLICY IF EXISTS "Doc owner or admin can add recipients" ON public.document_recipients;
DROP POLICY IF EXISTS "Doc owner or admin can add recipients" ON public.document_recipients;
CREATE POLICY "Doc owner or admin can add recipients"
  ON public.document_recipients FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id AND d.created_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  );

-- 3. inbox_items
DROP POLICY IF EXISTS "System can insert inbox" ON public.inbox_items;
DROP POLICY IF EXISTS "Users insert own inbox or admin insert any" ON public.inbox_items;
DROP POLICY IF EXISTS "Users insert own inbox or admin insert any" ON public.inbox_items;
CREATE POLICY "Users insert own inbox or admin insert any"
  ON public.inbox_items FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  );

-- 4. notifications
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users insert own notifications or admin insert any" ON public.notifications;
DROP POLICY IF EXISTS "Users insert own notifications or admin insert any" ON public.notifications;
CREATE POLICY "Users insert own notifications or admin insert any"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  );

-- 5. pp5_files
DROP POLICY IF EXISTS "Auth users can upload pp5_files" ON public.pp5_files;
DROP POLICY IF EXISTS "Staff can upload pp5_files" ON public.pp5_files;
DROP POLICY IF EXISTS "Staff can upload pp5_files" ON public.pp5_files;
CREATE POLICY "Staff can upload pp5_files"
  ON public.pp5_files FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );

-- 6. pp6_files
DROP POLICY IF EXISTS "Auth users can upload pp6_files" ON public.pp6_files;
DROP POLICY IF EXISTS "Staff can upload pp6_files" ON public.pp6_files;
DROP POLICY IF EXISTS "Staff can upload pp6_files" ON public.pp6_files;
CREATE POLICY "Staff can upload pp6_files"
  ON public.pp6_files FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  );