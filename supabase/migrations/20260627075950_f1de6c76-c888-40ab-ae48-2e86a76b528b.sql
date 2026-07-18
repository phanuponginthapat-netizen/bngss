
-- ===== 1. activities =====
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'other', -- sport|academic|art|other
  description text,
  location text,
  start_at timestamptz,
  end_at timestamptz,
  status text NOT NULL DEFAULT 'draft', -- draft|open|ongoing|finished
  cover_image_url text,
  max_score numeric DEFAULT 100,
  scoring_mode text NOT NULL DEFAULT 'points', -- points|rank|time
  academic_period_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_read_authenticated" ON public.activities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "activities_admin_manage" ON public.activities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

-- ===== 2. activity_participants =====
CREATE TABLE public.activity_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  team_name text,
  bib_no text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(activity_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_participants TO authenticated;
GRANT ALL ON public.activity_participants TO service_role;
ALTER TABLE public.activity_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ap_read_authenticated" ON public.activity_participants
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ap_admin_manage" ON public.activity_participants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

-- ===== 3. activity_scores =====
CREATE TABLE public.activity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.activity_participants(id) ON DELETE CASCADE,
  score numeric,
  rank integer,
  note text,
  judge_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_scores TO authenticated;
GRANT ALL ON public.activity_scores TO service_role;
ALTER TABLE public.activity_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "as_read_authenticated" ON public.activity_scores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "as_staff_manage" ON public.activity_scores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

-- ===== 4. activity_posts =====
CREATE TABLE public.activity_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  wall_post_id uuid,
  image_url text,
  posted_at timestamptz NOT NULL DEFAULT now(),
  posted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_posts TO authenticated;
GRANT ALL ON public.activity_posts TO service_role;
ALTER TABLE public.activity_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apost_read_authenticated" ON public.activity_posts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "apost_staff_manage" ON public.activity_posts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

-- ===== updated_at triggers =====
CREATE TRIGGER trg_activities_updated_at BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_activity_scores_updated_at BEFORE UPDATE ON public.activity_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Realtime =====
ALTER TABLE public.activities REPLICA IDENTITY FULL;
ALTER TABLE public.activity_participants REPLICA IDENTITY FULL;
ALTER TABLE public.activity_scores REPLICA IDENTITY FULL;
ALTER TABLE public.activity_posts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_posts;

-- ===== Indexes =====
CREATE INDEX idx_ap_activity ON public.activity_participants(activity_id);
CREATE INDEX idx_ap_student ON public.activity_participants(student_id);
CREATE INDEX idx_as_activity ON public.activity_scores(activity_id);
CREATE INDEX idx_activities_status ON public.activities(status);
CREATE INDEX idx_activities_start ON public.activities(start_at);
