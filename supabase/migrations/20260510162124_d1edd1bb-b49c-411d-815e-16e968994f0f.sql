
-- 1. iot_devices: restrict SELECT (api_token exposure)
DROP POLICY IF EXISTS "Authenticated users can view iot devices" ON public.iot_devices;
DROP POLICY IF EXISTS "Staff can view iot devices" ON public.iot_devices;
DROP POLICY IF EXISTS "Staff can view iot devices" ON public.iot_devices;
CREATE POLICY "Staff can view iot devices" ON public.iot_devices
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'));

-- 2. staff_evaluations: restrict SELECT to admin/director and the evaluated personnel
DROP POLICY IF EXISTS "Auth users can view staff_evaluations" ON public.staff_evaluations;
DROP POLICY IF EXISTS "Staff evaluations restricted view" ON public.staff_evaluations;
DROP POLICY IF EXISTS "Staff evaluations restricted view" ON public.staff_evaluations;
CREATE POLICY "Staff evaluations restricted view" ON public.staff_evaluations
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')
    OR EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = staff_evaluations.personnel_id AND p.user_id = auth.uid())
  );

-- 3. pa_agreements: restrict SELECT
DROP POLICY IF EXISTS "Auth users can view pa_agreements" ON public.pa_agreements;
DROP POLICY IF EXISTS "PA agreements restricted view" ON public.pa_agreements;
DROP POLICY IF EXISTS "PA agreements restricted view" ON public.pa_agreements;
CREATE POLICY "PA agreements restricted view" ON public.pa_agreements
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = pa_agreements.personnel_id AND p.user_id = auth.uid())
  );

-- 4. pa_indicator_scores: restrict SELECT
DROP POLICY IF EXISTS "Auth users can view pa_indicator_scores" ON public.pa_indicator_scores;
DROP POLICY IF EXISTS "PA indicator scores restricted view" ON public.pa_indicator_scores;
DROP POLICY IF EXISTS "PA indicator scores restricted view" ON public.pa_indicator_scores;
CREATE POLICY "PA indicator scores restricted view" ON public.pa_indicator_scores
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')
    OR EXISTS (
      SELECT 1 FROM public.pa_agreements pa
      LEFT JOIN public.personnel p ON p.id = pa.personnel_id
      WHERE pa.id = pa_indicator_scores.pa_agreement_id
        AND (pa.created_by = auth.uid() OR p.user_id = auth.uid())
    )
  );

-- 5. personnel: restrict full record SELECT to staff roles
DROP POLICY IF EXISTS "Authenticated view personnel basic" ON public.personnel;
DROP POLICY IF EXISTS "Staff can view personnel" ON public.personnel;
DROP POLICY IF EXISTS "Staff can view personnel" ON public.personnel;
CREATE POLICY "Staff can view personnel" ON public.personnel
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher')
    OR user_id = auth.uid()
  );

-- 6. homeroom_records: restrict SELECT
DROP POLICY IF EXISTS "Auth users can view homeroom_records" ON public.homeroom_records;
DROP POLICY IF EXISTS "Staff can view homeroom_records" ON public.homeroom_records;
DROP POLICY IF EXISTS "Staff can view homeroom_records" ON public.homeroom_records;
CREATE POLICY "Staff can view homeroom_records" ON public.homeroom_records
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'));

-- 7. account_balances: restrict SELECT
DROP POLICY IF EXISTS "Auth users can view account_balances" ON public.account_balances;
DROP POLICY IF EXISTS "Admin/Director view account_balances" ON public.account_balances;
DROP POLICY IF EXISTS "Admin/Director view account_balances" ON public.account_balances;
CREATE POLICY "Admin/Director view account_balances" ON public.account_balances
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

-- 8. procurement_records: restrict SELECT
DROP POLICY IF EXISTS "Auth users can view procurement_records" ON public.procurement_records;
DROP POLICY IF EXISTS "Admin/Director view procurement_records" ON public.procurement_records;
DROP POLICY IF EXISTS "Admin/Director view procurement_records" ON public.procurement_records;
CREATE POLICY "Admin/Director view procurement_records" ON public.procurement_records
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

-- 9. id_plan_records: restrict SELECT
DROP POLICY IF EXISTS "Auth users can view id_plan_records" ON public.id_plan_records;
DROP POLICY IF EXISTS "ID plan records restricted view" ON public.id_plan_records;
DROP POLICY IF EXISTS "ID plan records restricted view" ON public.id_plan_records;
CREATE POLICY "ID plan records restricted view" ON public.id_plan_records
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')
    OR EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = id_plan_records.personnel_id AND p.user_id = auth.uid())
  );

-- 10. attendance-photos bucket -> private + tightened policies
UPDATE storage.buckets SET public = false WHERE id = 'attendance-photos';
DROP POLICY IF EXISTS "Authenticated can view attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view attendance photos" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view attendance photos" ON storage.objects;
CREATE POLICY "Staff can view attendance photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'attendance-photos'
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'))
  );

-- 11. eform-attachments: add SELECT policy for sender + recipients
DROP POLICY IF EXISTS "eform attach: sender or recipient can view" ON storage.objects;
DROP POLICY IF EXISTS "eform attach: sender or recipient can view" ON storage.objects;
CREATE POLICY "eform attach: sender or recipient can view" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'eform-attachments'
    AND EXISTS (
      SELECT 1 FROM public.eforms e
      WHERE (e.id)::text = (storage.foldername(storage.objects.name))[1]
        AND (
          e.sender_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.eform_recipients r WHERE r.eform_id = e.id AND r.recipient_id = auth.uid())
        )
    )
  );
