-- ============================================
-- 1. เพิ่มฟังก์ชัน auto-link student กับ auth user
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_link_student_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p_email TEXT;
  p_student_code TEXT;
BEGIN
  SELECT email INTO p_email FROM auth.users WHERE id = NEW.id;
  p_student_code := NEW.student_code;

  IF p_student_code IS NOT NULL THEN
    UPDATE public.students
    SET auth_user_id = NEW.id
    WHERE student_code = p_student_code AND auth_user_id IS NULL;
  END IF;

  IF p_email IS NOT NULL AND NOT FOUND THEN
    UPDATE public.students
    SET auth_user_id = NEW.id
    WHERE email = p_email AND auth_user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;
-- ============================================
-- 2. ผูก trigger บน profiles → personnel + students
-- ============================================
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_link_personnel ON public.profiles';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_auto_link_personnel
AFTER INSERT OR UPDATE OF employee_code ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_link_personnel_on_profile()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_link_student ON public.profiles';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_auto_link_student
AFTER INSERT OR UPDATE OF student_code ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_link_student_on_profile()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============================================
-- 3. ผูก trigger สอนแทนอัตโนมัติบน staff_leaves
-- ============================================
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_substitute_on_leave ON public.staff_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_auto_substitute_on_leave
AFTER UPDATE OF status ON public.staff_leaves
FOR EACH ROW EXECUTE FUNCTION public.auto_create_substitute_on_leave_approval()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============================================
-- 4. ผูก notification triggers
-- ============================================
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_emergency ON public.emergency_broadcasts';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_emergency
AFTER INSERT ON public.emergency_broadcasts
FOR EACH ROW EXECUTE FUNCTION public.notify_users_on_news()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_news ON public.news_posts';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_news
AFTER INSERT OR UPDATE OF is_published ON public.news_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_users_on_news()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_damage ON public.asset_damage_reports';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_damage
AFTER INSERT ON public.asset_damage_reports
FOR EACH ROW EXECUTE FUNCTION public.notify_on_damage_report()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_eform_recipient ON public.eform_recipients';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_eform_recipient
AFTER INSERT ON public.eform_recipients
FOR EACH ROW EXECUTE FUNCTION public.notify_on_eform_recipient()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_eform_action ON public.eform_recipients';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_eform_action
AFTER UPDATE ON public.eform_recipients
FOR EACH ROW EXECUTE FUNCTION public.notify_sender_on_recipient_action()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_recompute_eform_status ON public.eform_recipients';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_recompute_eform_status
AFTER UPDATE ON public.eform_recipients
FOR EACH ROW EXECUTE FUNCTION public.recompute_eform_status()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_doc_reply ON public.document_recipients';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_doc_reply
AFTER UPDATE ON public.document_recipients
FOR EACH ROW EXECUTE FUNCTION public.notify_sender_on_document_reply()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_doc_created ON public.documents';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_doc_created
AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.notify_on_document_created()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_staff_leave ON public.staff_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_staff_leave
AFTER INSERT ON public.staff_leaves
FOR EACH ROW EXECUTE FUNCTION public.notify_on_staff_leave()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_student_leave ON public.student_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_student_leave
AFTER INSERT ON public.student_leaves
FOR EACH ROW EXECUTE FUNCTION public.notify_on_student_leave()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_negative_behavior ON public.behavior_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_negative_behavior
AFTER INSERT ON public.behavior_records
FOR EACH ROW EXECUTE FUNCTION public.notify_on_negative_behavior()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_absence ON public.attendance';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_absence
AFTER INSERT ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.notify_parents_on_absence()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============================================
-- 5. Notification → Inbox sync
-- ============================================
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_notif_to_inbox ON public.notifications';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_sync_notif_to_inbox
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.sync_notification_to_inbox()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============================================
-- 6. Procurement → Budget auto-deduct
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_deduct_budget_on_procurement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  amt NUMERIC;
BEGIN
  -- หักงบเฉพาะเมื่อสถานะอนุมัติ/ดำเนินการแล้ว
  IF NEW.status IN ('approved', 'completed', 'paid') 
     AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('approved','completed','paid')) THEN
    amt := COALESCE(NEW.total_amount, 0);
    IF amt > 0 THEN
      INSERT INTO public.budget_transactions (
        transaction_type, transaction_date, category, description, amount,
        budget_source, fiscal_year, project_name, receipt_number
      ) VALUES (
        'expense', CURRENT_DATE, 'procurement',
        'จัดซื้อจัดจ้าง: ' || COALESCE(NEW.item_name, NEW.description, '-'),
        amt, COALESCE(NEW.budget_source,'งบประมาณ'),
        EXTRACT(year FROM now())::int,
        NEW.item_name, NEW.po_number
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_deduct_budget ON public.procurement_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_auto_deduct_budget
AFTER INSERT OR UPDATE OF status ON public.procurement_records
FOR EACH ROW EXECUTE FUNCTION public.auto_deduct_budget_on_procurement()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
