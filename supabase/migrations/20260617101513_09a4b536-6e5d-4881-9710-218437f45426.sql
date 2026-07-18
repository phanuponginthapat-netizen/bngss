
-- Subject group heads (หัวหน้ากลุ่มสาระ 8 + งานเด็กพิเศษ)
CREATE TABLE public.subject_group_heads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_group text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_group, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_group_heads TO authenticated;
GRANT ALL ON public.subject_group_heads TO service_role;

ALTER TABLE public.subject_group_heads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view subject group heads"
  ON public.subject_group_heads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/directors manage subject group heads"
  ON public.subject_group_heads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_subject_group_heads_updated_at
BEFORE UPDATE ON public.subject_group_heads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_subject_group_heads_group ON public.subject_group_heads(subject_group);
CREATE INDEX idx_subject_group_heads_user ON public.subject_group_heads(user_id);

-- Helper function for checking if user is head of a subject group
CREATE OR REPLACE FUNCTION public.is_subject_group_head(_user_id uuid, _group text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subject_group_heads
    WHERE user_id = _user_id AND subject_group = _group
  );
$$;

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.subject_group_heads;
