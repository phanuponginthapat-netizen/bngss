
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS registration_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS max_participants integer,
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'free';

CREATE TABLE IF NOT EXISTS public.activity_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  round int NOT NULL DEFAULT 1,
  match_no int NOT NULL DEFAULT 1,
  bracket_slot text,
  participant_a_id uuid REFERENCES public.activity_participants(id) ON DELETE SET NULL,
  participant_b_id uuid REFERENCES public.activity_participants(id) ON DELETE SET NULL,
  score_a numeric,
  score_b numeric,
  winner_id uuid REFERENCES public.activity_participants(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_at timestamptz,
  court text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_matches TO authenticated;
GRANT ALL ON public.activity_matches TO service_role;

ALTER TABLE public.activity_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY am_read_authenticated ON public.activity_matches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY am_admin_manage ON public.activity_matches
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role));

CREATE INDEX IF NOT EXISTS activity_matches_activity_idx ON public.activity_matches(activity_id, round, match_no);

CREATE TRIGGER update_activity_matches_updated_at
  BEFORE UPDATE ON public.activity_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_matches;
ALTER TABLE public.activity_matches REPLICA IDENTITY FULL;

-- Allow students to self-register / self-withdraw when registration is open
CREATE POLICY ap_student_self_register ON public.activity_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_id
        AND a.registration_open = true
        AND (a.registration_deadline IS NULL OR a.registration_deadline > now())
    )
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id AND s.auth_user_id = auth.uid()
    )
  );

CREATE POLICY ap_student_self_withdraw ON public.activity_participants
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = student_id AND s.auth_user_id = auth.uid()
    )
  );
