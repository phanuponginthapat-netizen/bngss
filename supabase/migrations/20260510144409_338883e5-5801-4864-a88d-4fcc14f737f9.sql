
-- Enum for device category
DO $$ BEGIN
  CREATE TYPE public.ict_device_category AS ENUM ('notebook', 'tablet', 'mobile', 'camera', 'projector', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ict_device_status AS ENUM ('available', 'borrowed', 'maintenance', 'lost', 'retired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ict_loan_status AS ENUM ('active', 'returned', 'overdue', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Devices
CREATE TABLE IF NOT EXISTS public.ict_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code text NOT NULL UNIQUE,
  name text NOT NULL,
  category public.ict_device_category NOT NULL DEFAULT 'notebook',
  brand text,
  model text,
  serial_number text,
  photo_url text,
  status public.ict_device_status NOT NULL DEFAULT 'available',
  notes text,
  school_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ict_devices_status ON public.ict_devices(status);
CREATE INDEX IF NOT EXISTS idx_ict_devices_asset_code ON public.ict_devices(asset_code);
CREATE INDEX IF NOT EXISTS idx_ict_devices_serial ON public.ict_devices(serial_number);

-- Loans
CREATE TABLE IF NOT EXISTS public.ict_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.ict_devices(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  borrowed_at timestamptz NOT NULL DEFAULT now(),
  borrowed_by uuid,
  borrow_photo_url text,
  borrow_notes text,
  expected_return_at timestamptz,
  returned_at timestamptz,
  returned_by uuid,
  return_photo_url text,
  return_notes text,
  condition_on_return text,
  status public.ict_loan_status NOT NULL DEFAULT 'active',
  school_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ict_loans_student ON public.ict_loans(student_id);
CREATE INDEX IF NOT EXISTS idx_ict_loans_device ON public.ict_loans(device_id);
CREATE INDEX IF NOT EXISTS idx_ict_loans_status ON public.ict_loans(status);

-- Updated_at triggers
DROP TRIGGER IF EXISTS trg_ict_devices_updated_at ON public.ict_devices;
CREATE TRIGGER trg_ict_devices_updated_at BEFORE UPDATE ON public.ict_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_ict_loans_updated_at ON public.ict_loans;
CREATE TRIGGER trg_ict_loans_updated_at BEFORE UPDATE ON public.ict_loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-fill school_id
DROP TRIGGER IF EXISTS trg_ict_devices_fill_school ON public.ict_devices;
CREATE TRIGGER trg_ict_devices_fill_school BEFORE INSERT ON public.ict_devices
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id();
DROP TRIGGER IF EXISTS trg_ict_loans_fill_school ON public.ict_loans;
CREATE TRIGGER trg_ict_loans_fill_school BEFORE INSERT ON public.ict_loans
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id();

-- Sync device status from loan
CREATE OR REPLACE FUNCTION public.sync_ict_device_status_on_loan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      UPDATE public.ict_devices SET status = 'borrowed', updated_at = now()
        WHERE id = NEW.device_id AND status = 'available';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'returned' AND OLD.status <> 'returned' THEN
      UPDATE public.ict_devices SET status = 'available', updated_at = now()
        WHERE id = NEW.device_id;
    ELSIF NEW.status = 'lost' AND OLD.status <> 'lost' THEN
      UPDATE public.ict_devices SET status = 'lost', updated_at = now()
        WHERE id = NEW.device_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ict_loans_sync_device ON public.ict_loans;
CREATE TRIGGER trg_ict_loans_sync_device
  AFTER INSERT OR UPDATE ON public.ict_loans
  FOR EACH ROW EXECUTE FUNCTION public.sync_ict_device_status_on_loan();

-- Prevent double-borrow: only one active loan per device
CREATE UNIQUE INDEX IF NOT EXISTS uq_ict_loans_active_device
  ON public.ict_loans(device_id) WHERE status = 'active';

-- Notify student when borrowed/returned
CREATE OR REPLACE FUNCTION public.notify_student_on_ict_loan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid;
  device_name text;
BEGIN
  SELECT auth_user_id INTO uid FROM public.students WHERE id = NEW.student_id;
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
END $$;

DROP TRIGGER IF EXISTS trg_ict_loans_notify ON public.ict_loans;
CREATE TRIGGER trg_ict_loans_notify
  AFTER INSERT OR UPDATE ON public.ict_loans
  FOR EACH ROW EXECUTE FUNCTION public.notify_student_on_ict_loan();

-- RLS
ALTER TABLE public.ict_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ict_loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devices viewable by authenticated" ON public.ict_devices;
CREATE POLICY "Devices viewable by authenticated"
  ON public.ict_devices FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Devices manage by staff" ON public.ict_devices;
CREATE POLICY "Devices manage by staff"
  ON public.ict_devices FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'));

DROP POLICY IF EXISTS "Loans viewable by staff or own student" ON public.ict_loans;
CREATE POLICY "Loans viewable by staff or own student"
  ON public.ict_loans FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher')
    OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = ict_loans.student_id AND s.auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.parent_student_links psl WHERE psl.student_id = ict_loans.student_id AND psl.parent_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Loans managed by staff" ON public.ict_loans;
CREATE POLICY "Loans managed by staff"
  ON public.ict_loans FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ict-loan-photos', 'ict-loan-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "ICT photos public read" ON storage.objects;
CREATE POLICY "ICT photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ict-loan-photos');

DROP POLICY IF EXISTS "ICT photos staff upload" ON storage.objects;
CREATE POLICY "ICT photos staff upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ict-loan-photos' AND
    (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'))
  );

DROP POLICY IF EXISTS "ICT photos staff update" ON storage.objects;
CREATE POLICY "ICT photos staff update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ict-loan-photos' AND
    (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'))
  );
