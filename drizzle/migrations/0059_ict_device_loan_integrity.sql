GRANT SELECT,INSERT,UPDATE,DELETE ON public.ict_devices TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.ict_loans TO authenticated;
GRANT ALL ON public.ict_devices,public.ict_loans TO service_role;
CREATE POLICY ict_devices_admin_manage ON public.ict_devices FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY ict_devices_student_read ON public.ict_devices FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'student'));
CREATE POLICY ict_loans_staff_read ON public.ict_loans FOR SELECT TO authenticated USING (public._staff_check(auth.uid()));
CREATE POLICY ict_loans_staff_insert ON public.ict_loans FOR INSERT TO authenticated WITH CHECK (public._staff_check(auth.uid()));
CREATE POLICY ict_loans_staff_update ON public.ict_loans FOR UPDATE TO authenticated USING (public._staff_check(auth.uid())) WITH CHECK (public._staff_check(auth.uid()));
CREATE POLICY ict_loans_owner_read ON public.ict_loans FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.auth_user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.personnel p WHERE p.id=personnel_id AND p.user_id=auth.uid()));
CREATE OR REPLACE FUNCTION public.ict_device_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF EXISTS(SELECT 1 FROM public.ict_loans WHERE device_id=OLD.id) THEN RAISE EXCEPTION 'อุปกรณ์มีประวัติยืม–คืน กรุณาปลดระวางแทนการลบ'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.status='borrowed' AND NOT EXISTS(SELECT 1 FROM public.ict_loans WHERE device_id=NEW.id AND status='active') THEN RAISE EXCEPTION 'สถานะถูกยืมต้องมาจากรายการยืมจริง'; END IF;
 IF TG_OP='UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status<>'borrowed' AND EXISTS(SELECT 1 FROM public.ict_loans WHERE device_id=OLD.id AND status='active') THEN RAISE EXCEPTION 'ต้องคืนอุปกรณ์ก่อนเปลี่ยนสถานะ'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ict_device_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ict_devices FOR EACH ROW EXECUTE FUNCTION public.ict_device_guard();
CREATE OR REPLACE FUNCTION public.ict_loan_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE state public.ict_device_status;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT status INTO state FROM public.ict_devices WHERE id=NEW.device_id FOR UPDATE;
  IF state IS NULL OR state<>'available' THEN RAISE EXCEPTION 'อุปกรณ์ไม่พร้อมยืม'; END IF;
  IF NEW.status<>'active' THEN RAISE EXCEPTION 'รายการใหม่ต้องเป็นการยืม'; END IF;
  IF NEW.expected_return_at IS NOT NULL AND NEW.expected_return_at<=NEW.borrowed_at THEN RAISE EXCEPTION 'กำหนดคืนต้องหลังเวลายืม'; END IF;
 ELSE
  IF NEW.device_id IS DISTINCT FROM OLD.device_id OR NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.personnel_id IS DISTINCT FROM OLD.personnel_id THEN RAISE EXCEPTION 'ไม่สามารถเปลี่ยนอุปกรณ์หรือผู้ยืมในประวัติ'; END IF;
  IF OLD.status<>'active' AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'รายการยืมสิ้นสุดแล้ว'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ict_loan_guard BEFORE INSERT OR UPDATE ON public.ict_loans FOR EACH ROW EXECUTE FUNCTION public.ict_loan_guard();