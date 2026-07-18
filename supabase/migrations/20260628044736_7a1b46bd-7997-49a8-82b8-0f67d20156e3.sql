
-- Bonus points (คะแนนพิเศษ เช่น ขบวนพาเหรด กองเชียร์ มารยาท)
CREATE TABLE IF NOT EXISTS public.sports_day_bonus_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_id uuid NOT NULL REFERENCES public.sports_day_meets(id) ON DELETE CASCADE,
  house_id uuid NOT NULL REFERENCES public.sports_day_houses(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  points numeric NOT NULL DEFAULT 0,
  awarded_at date NOT NULL DEFAULT CURRENT_DATE,
  awarded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_day_bonus_points TO authenticated;
GRANT ALL ON public.sports_day_bonus_points TO service_role;
ALTER TABLE public.sports_day_bonus_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdbp_read_all" ON public.sports_day_bonus_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "sdbp_staff_manage" ON public.sports_day_bonus_points FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));
CREATE TRIGGER trg_sdbp_updated_at BEFORE UPDATE ON public.sports_day_bonus_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_sdbp_meet ON public.sports_day_bonus_points(meet_id);
CREATE INDEX IF NOT EXISTS idx_sdbp_house ON public.sports_day_bonus_points(house_id);

-- Extra meet/house metadata
ALTER TABLE public.sports_day_meets
  ADD COLUMN IF NOT EXISTS venue text,
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS opening_at timestamptz,
  ADD COLUMN IF NOT EXISTS closing_at timestamptz;

ALTER TABLE public.sports_day_houses
  ADD COLUMN IF NOT EXISTS motto text,
  ADD COLUMN IF NOT EXISTS tent_location text;

ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_day_bonus_points;
