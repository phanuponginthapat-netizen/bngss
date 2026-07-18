
ALTER TABLE public.ict_loans ADD COLUMN IF NOT EXISTS personnel_id uuid REFERENCES public.personnel(id) ON DELETE CASCADE;
ALTER TABLE public.ict_loans ALTER COLUMN student_id DROP NOT NULL;

-- exactly one borrower
ALTER TABLE public.ict_loans DROP CONSTRAINT IF EXISTS ict_loans_one_borrower;
ALTER TABLE public.ict_loans ADD CONSTRAINT ict_loans_one_borrower
  CHECK ((student_id IS NOT NULL)::int + (personnel_id IS NOT NULL)::int = 1);

CREATE INDEX IF NOT EXISTS idx_ict_loans_personnel ON public.ict_loans (personnel_id, borrowed_at DESC);

-- Update viewable policy to include personnel
DROP POLICY IF EXISTS "Loans viewable by staff or own student" ON public.ict_loans;
CREATE POLICY "Loans viewable by staff student or personnel"
ON public.ict_loans FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR EXISTS (SELECT 1 FROM students s WHERE s.id = ict_loans.student_id AND s.auth_user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM parent_student_links psl WHERE psl.student_id = ict_loans.student_id AND psl.parent_user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM personnel p WHERE p.id = ict_loans.personnel_id AND p.user_id = auth.uid())
);

-- Update notify trigger to handle personnel borrowers too
CREATE OR REPLACE FUNCTION public.notify_student_on_ict_loan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid;
  device_name text;
BEGIN
  IF NEW.student_id IS NOT NULL THEN
    SELECT auth_user_id INTO uid FROM public.students WHERE id = NEW.student_id;
  ELSIF NEW.personnel_id IS NOT NULL THEN
    SELECT user_id INTO uid FROM public.personnel WHERE id = NEW.personnel_id;
  END IF;
  SELECT name INTO device_name FROM public.ict_devices WHERE id = NEW.device_id;
  IF uid IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (uid, '💻 ยืมอุปกรณ์ ICT', 'ยืม ' || COALESCE(device_name,'อุปกรณ์') || ' สำเร็จ',
      'ict_loan', 'ict_loan', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'returned' AND OLD.status <> 'returned' THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (uid, '✅ คืนอุปกรณ์ ICT', 'คืน ' || COALESCE(device_name,'อุปกรณ์') || ' เรียบร้อย',
      'ict_loan', 'ict_loan', NEW.id);
  END IF;
  RETURN NEW;
END $function$;
