
CREATE TABLE IF NOT EXISTS public.teaching_reflection_signature_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE,
  signature_id uuid REFERENCES public.director_signatures(id) ON DELETE SET NULL,
  render_mode text NOT NULL DEFAULT 'image' CHECK (render_mode IN ('image','blank','name_only')),
  align text NOT NULL DEFAULT 'center' CHECK (align IN ('left','center','right')),
  offset_x_mm numeric NOT NULL DEFAULT 0,
  offset_y_mm numeric NOT NULL DEFAULT 0,
  size_preset text NOT NULL DEFAULT 'md' CHECK (size_preset IN ('sm','md','lg','custom')),
  size_px integer NOT NULL DEFAULT 40,
  show_comment_line boolean NOT NULL DEFAULT true,
  override_name text,
  override_position text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.teaching_reflection_signature_settings TO authenticated;
GRANT ALL ON public.teaching_reflection_signature_settings TO service_role;

ALTER TABLE public.teaching_reflection_signature_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sig_settings_read_all_auth" ON public.teaching_reflection_signature_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "sig_settings_admin_write" ON public.teaching_reflection_signature_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE TRIGGER trg_reflection_sig_settings_updated_at
  BEFORE UPDATE ON public.teaching_reflection_signature_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default rows for 5 roles
INSERT INTO public.teaching_reflection_signature_settings (role) VALUES
  ('teacher'), ('head_subject'), ('academic_head'), ('deputy'), ('director')
ON CONFLICT (role) DO NOTHING;
