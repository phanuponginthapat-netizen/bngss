
-- Special rooms table
CREATE TABLE public.special_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  location text,
  capacity integer,
  image_url text,
  color text DEFAULT 'emerald',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.special_rooms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_rooms TO authenticated;
GRANT ALL ON public.special_rooms TO service_role;

ALTER TABLE public.special_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Special rooms readable" ON public.special_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage rooms insert" ON public.special_rooms FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY "Admin manage rooms update" ON public.special_rooms FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY "Admin manage rooms delete" ON public.special_rooms FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TRIGGER update_special_rooms_updated_at BEFORE UPDATE ON public.special_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add room_id to bookings
ALTER TABLE public.learning_center_bookings
  ADD COLUMN room_id uuid REFERENCES public.special_rooms(id) ON DELETE SET NULL;

CREATE INDEX idx_lcb_room ON public.learning_center_bookings(room_id);

-- Replace unique slot to be per-room
DROP INDEX IF EXISTS public.uq_lcb_slot;
CREATE UNIQUE INDEX uq_lcb_slot ON public.learning_center_bookings(room_id, booking_date, start_time) WHERE status = 'confirmed';

-- Seed default Learning Center room
INSERT INTO public.special_rooms (name, description, location, color, sort_order)
VALUES ('Learning Center', 'ห้อง Learning Center หลัก', 'อาคารเรียนหลัก', 'emerald', 0);

-- Backfill existing bookings to default room
UPDATE public.learning_center_bookings
SET room_id = (SELECT id FROM public.special_rooms ORDER BY created_at LIMIT 1)
WHERE room_id IS NULL;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.special_rooms;
