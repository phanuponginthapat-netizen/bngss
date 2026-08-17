-- 1) Add room column to schedules (where this period happens — e.g. "Learning Center", "ห้องคอมฯ 1")
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS room text;

-- 2) Learning Center bookings table
CREATE TABLE IF NOT EXISTS public.learning_center_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  period integer,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject_name text,
  classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL,
  classroom_name text,
  teacher_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  teacher_name text NOT NULL,
  topic text,
  status text NOT NULL DEFAULT 'confirmed',
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lcb_time_valid CHECK (end_time > start_time),
  CONSTRAINT lcb_status_valid CHECK (status IN ('confirmed','cancelled'))
);

GRANT SELECT ON public.learning_center_bookings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.learning_center_bookings TO authenticated;
GRANT ALL ON public.learning_center_bookings TO service_role;

ALTER TABLE public.learning_center_bookings ENABLE ROW LEVEL SECURITY;

-- All authenticated can view (everyone can see room schedule)
DROP POLICY IF EXISTS "LCB viewable by authenticated" ON public.learning_center_bookings;
CREATE POLICY "LCB viewable by authenticated"
  ON public.learning_center_bookings FOR SELECT
  TO authenticated USING (true);

-- Teachers/staff can create bookings
DROP POLICY IF EXISTS "Staff can create bookings" ON public.learning_center_bookings;
CREATE POLICY "Staff can create bookings"
  ON public.learning_center_bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher')
  );

-- Owner or admin/director can update
DROP POLICY IF EXISTS "Owner or admin update bookings" ON public.learning_center_bookings;
CREATE POLICY "Owner or admin update bookings"
  ON public.learning_center_bookings FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(),'admin')
    OR has_role(auth.uid(),'director')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR has_role(auth.uid(),'admin')
    OR has_role(auth.uid(),'director')
  );

-- Owner or admin/director can delete
DROP POLICY IF EXISTS "Owner or admin delete bookings" ON public.learning_center_bookings;
CREATE POLICY "Owner or admin delete bookings"
  ON public.learning_center_bookings FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(),'admin')
    OR has_role(auth.uid(),'director')
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lcb_date_time ON public.learning_center_bookings (booking_date, start_time);
CREATE INDEX IF NOT EXISTS idx_lcb_teacher ON public.learning_center_bookings (teacher_id);
CREATE INDEX IF NOT EXISTS idx_lcb_school ON public.learning_center_bookings (school_id);

-- Prevent double-booking the same slot (same date + overlapping time would need exclusion;
-- enforce simple unique on (booking_date, start_time) which covers period-based booking).
CREATE UNIQUE INDEX IF NOT EXISTS uq_lcb_slot
  ON public.learning_center_bookings (booking_date, start_time)
  WHERE status = 'confirmed';

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_lcb_updated_at ON public.learning_center_bookings;
CREATE TRIGGER trg_lcb_updated_at
  BEFORE UPDATE ON public.learning_center_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-fill school_id from creator if not provided
CREATE OR REPLACE FUNCTION public.lcb_fill_school()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.school_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id FROM public.profiles WHERE id = NEW.created_by LIMIT 1;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lcb_fill_school ON public.learning_center_bookings;
CREATE TRIGGER trg_lcb_fill_school
  BEFORE INSERT ON public.learning_center_bookings
  FOR EACH ROW EXECUTE FUNCTION public.lcb_fill_school();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.learning_center_bookings;
ALTER TABLE public.learning_center_bookings REPLICA IDENTITY FULL;