
-- 1) Meets
CREATE TABLE IF NOT EXISTS public.sports_day_meets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  academic_period_id uuid REFERENCES public.academic_periods(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  gold_points smallint NOT NULL DEFAULT 5,
  silver_points smallint NOT NULL DEFAULT 3,
  bronze_points smallint NOT NULL DEFAULT 1,
  cover_image_url text,
  status text NOT NULL DEFAULT 'planning',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_day_meets TO authenticated;
GRANT ALL ON public.sports_day_meets TO service_role;
ALTER TABLE public.sports_day_meets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdm_read_all" ON public.sports_day_meets FOR SELECT TO authenticated USING (true);
CREATE POLICY "sdm_staff_manage" ON public.sports_day_meets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));
CREATE TRIGGER trg_sdm_updated_at BEFORE UPDATE ON public.sports_day_meets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Houses (คณะสี)
CREATE TABLE IF NOT EXISTS public.sports_day_houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_id uuid NOT NULL REFERENCES public.sports_day_meets(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  emblem_url text,
  captain_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  advisor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meet_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_day_houses TO authenticated;
GRANT ALL ON public.sports_day_houses TO service_role;
ALTER TABLE public.sports_day_houses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdh_read_all" ON public.sports_day_houses FOR SELECT TO authenticated USING (true);
CREATE POLICY "sdh_staff_manage" ON public.sports_day_houses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));
CREATE TRIGGER trg_sdh_updated_at BEFORE UPDATE ON public.sports_day_houses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_sdh_meet ON public.sports_day_houses(meet_id);

-- 3) House members (นักเรียนในสี)
CREATE TABLE IF NOT EXISTS public.sports_day_house_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id uuid NOT NULL REFERENCES public.sports_day_houses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  meet_id uuid NOT NULL REFERENCES public.sports_day_meets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meet_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_day_house_members TO authenticated;
GRANT ALL ON public.sports_day_house_members TO service_role;
ALTER TABLE public.sports_day_house_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sdhm_read_all" ON public.sports_day_house_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "sdhm_staff_manage" ON public.sports_day_house_members FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));
CREATE INDEX IF NOT EXISTS idx_sdhm_meet ON public.sports_day_house_members(meet_id);
CREATE INDEX IF NOT EXISTS idx_sdhm_house ON public.sports_day_house_members(house_id);

-- 4) Link activities + participants
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS sports_day_meet_id uuid REFERENCES public.sports_day_meets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_activities_sports_day ON public.activities(sports_day_meet_id);

ALTER TABLE public.activity_participants
  ADD COLUMN IF NOT EXISTS sports_day_house_id uuid REFERENCES public.sports_day_houses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ap_sports_day_house ON public.activity_participants(sports_day_house_id);

-- 5) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_day_meets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_day_houses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_day_house_members;

-- 6) Auto-fill house_id from member assignment when adding participant
CREATE OR REPLACE FUNCTION public.fill_sports_day_house()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meet uuid;
BEGIN
  IF NEW.sports_day_house_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT sports_day_meet_id INTO meet FROM public.activities WHERE id = NEW.activity_id;
  IF meet IS NULL THEN RETURN NEW; END IF;
  SELECT house_id INTO NEW.sports_day_house_id
    FROM public.sports_day_house_members
   WHERE meet_id = meet AND student_id = NEW.student_id
   LIMIT 1;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fill_sports_day_house ON public.activity_participants;
CREATE TRIGGER trg_fill_sports_day_house
  BEFORE INSERT ON public.activity_participants
  FOR EACH ROW EXECUTE FUNCTION public.fill_sports_day_house();
