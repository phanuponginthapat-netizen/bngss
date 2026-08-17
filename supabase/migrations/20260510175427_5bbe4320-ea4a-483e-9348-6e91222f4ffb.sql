
-- ============================================
-- 1. FIX: assets table — remove blanket public SELECT
-- ============================================
DROP POLICY IF EXISTS "Public can view asset basics for return lookup" ON public.assets;

-- Public lookup view exposes only safe fields (for return/QR lookup)
CREATE OR REPLACE VIEW public.assets_public_lookup
WITH (security_invoker = on) AS
SELECT id, asset_code, asset_name, category, status, location
FROM public.assets;

GRANT SELECT ON public.assets_public_lookup TO anon, authenticated;

-- Staff (admin/director/teacher) can read full asset details
DROP POLICY IF EXISTS "Staff can view assets" ON public.assets;
DROP POLICY IF EXISTS "Staff can view assets" ON public.assets;
CREATE POLICY "Staff can view assets"
ON public.assets FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(),'admin') OR
  has_role(auth.uid(),'director') OR
  has_role(auth.uid(),'teacher')
);

-- Allow public lookup of basic fields via the view (view will use security_invoker, so we need a permissive SELECT for non-sensitive use cases)
-- Use a separate restrictive SELECT for anon: only allow SELECT through the view (which already filters columns).
-- Since security_invoker views run with caller's permissions, we add a minimal anon SELECT policy on the table BUT only on columns is not supported in RLS.
-- Pragmatic approach: deny anon entirely; the lookup view requires authenticated session.
-- If anonymous QR-scan lookup is needed, expose a SECURITY DEFINER RPC instead.

-- ============================================
-- 2. FIX: document_recipients — scope SELECT
-- ============================================
DROP POLICY IF EXISTS "Auth users can view document_recipients" ON public.document_recipients;

DROP POLICY IF EXISTS "Recipients and staff can view document_recipients" ON public.document_recipients;
DROP POLICY IF EXISTS "Recipients and staff can view document_recipients" ON public.document_recipients;
CREATE POLICY "Recipients and staff can view document_recipients"
ON public.document_recipients FOR SELECT
TO authenticated
USING (
  recipient_user_id = auth.uid()
  OR has_role(auth.uid(),'admin')
  OR has_role(auth.uid(),'director')
  OR EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.id = document_recipients.document_id
      AND d.created_by = auth.uid()
  )
);

-- ============================================
-- 3. FIX: early_childhood_dev — restrict SELECT
-- ============================================
DROP POLICY IF EXISTS "Auth users can view early_childhood_dev" ON public.early_childhood_dev;

DROP POLICY IF EXISTS "Staff can view early_childhood_dev" ON public.early_childhood_dev;
DROP POLICY IF EXISTS "Staff can view early_childhood_dev" ON public.early_childhood_dev;
CREATE POLICY "Staff can view early_childhood_dev"
ON public.early_childhood_dev FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(),'admin') OR
  has_role(auth.uid(),'director') OR
  has_role(auth.uid(),'teacher')
);

DROP POLICY IF EXISTS "Parents view linked early_childhood_dev" ON public.early_childhood_dev;
DROP POLICY IF EXISTS "Parents view linked early_childhood_dev" ON public.early_childhood_dev;
CREATE POLICY "Parents view linked early_childhood_dev"
ON public.early_childhood_dev FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(),'parent') AND student_id IN (
    SELECT student_id FROM public.parent_student_links
    WHERE parent_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Students view own early_childhood_dev" ON public.early_childhood_dev;
DROP POLICY IF EXISTS "Students view own early_childhood_dev" ON public.early_childhood_dev;
CREATE POLICY "Students view own early_childhood_dev"
ON public.early_childhood_dev FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
);

-- ============================================
-- 4. FIX: behavior_records — staff manage + student self-view
-- ============================================
DROP POLICY IF EXISTS "Staff can manage behavior_records" ON public.behavior_records;
DROP POLICY IF EXISTS "Staff can manage behavior_records" ON public.behavior_records;
CREATE POLICY "Staff can manage behavior_records"
ON public.behavior_records FOR ALL
TO authenticated
USING (
  has_role(auth.uid(),'admin') OR
  has_role(auth.uid(),'director') OR
  has_role(auth.uid(),'teacher')
)
WITH CHECK (
  has_role(auth.uid(),'admin') OR
  has_role(auth.uid(),'director') OR
  has_role(auth.uid(),'teacher')
);

DROP POLICY IF EXISTS "Students view own behavior" ON public.behavior_records;
DROP POLICY IF EXISTS "Students view own behavior" ON public.behavior_records;
CREATE POLICY "Students view own behavior"
ON public.behavior_records FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid())
);

-- ============================================
-- 5. REVOKE EXECUTE on trigger-only SECURITY DEFINER functions
--    These are called only by triggers; no one should invoke them directly.
-- ============================================
DO $$
DECLARE
  fn text;
  trigger_only_fns text[] := ARRAY[
    'notify_on_negative_behavior','notify_on_garbage_deposit','sync_ict_device_status_on_loan',
    'notify_users_on_news','auto_link_personnel_on_profile','recompute_eform_status',
    'handle_new_user','process_redemption','notify_on_eform_recipient',
    'auto_deduct_budget_on_procurement','notify_sender_on_recipient_action',
    'notify_line_on_notification','notify_on_document_created','auto_enroll_students_on_assignment',
    'trigger_push_notification','auto_create_student_screening','update_updated_at_column',
    'auto_compute_total_score','notify_parents_on_absence','add_points_on_deposit',
    'auto_fill_school_id','notify_on_staff_leave','notify_on_badge_earned',
    'notify_on_emergency','enforce_eform_recipient_role','notify_student_on_ict_loan',
    'auto_link_student_on_profile','notify_on_damage_report','sync_notification_to_inbox',
    'notify_on_student_leave','auto_create_substitute_on_leave_approval',
    'check_and_grant_badges','notify_sender_on_document_reply'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_only_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I() FROM anon, authenticated, public', fn);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- Restrict admin-only RPCs
REVOKE EXECUTE ON FUNCTION public.archive_and_purge_old_data(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.archive_old_data() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_purge_preview(integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_cloud_usage_summary() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_available_academic_years() FROM anon, public;
