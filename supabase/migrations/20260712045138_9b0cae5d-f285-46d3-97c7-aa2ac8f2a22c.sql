
CREATE TABLE public.padlet_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  background text DEFAULT 'paper',
  layout text NOT NULL DEFAULT 'grid',
  is_public boolean NOT NULL DEFAULT false,
  allow_guest_post boolean NOT NULL DEFAULT true,
  share_code text UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.padlet_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.padlet_boards(id) ON DELETE CASCADE,
  author_id uuid,
  author_name text,
  content text,
  color text DEFAULT 'yellow',
  image_url text,
  link_url text,
  position integer NOT NULL DEFAULT 0,
  column_key text,
  likes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_padlet_notes_board ON public.padlet_notes(board_id, position);
CREATE INDEX idx_padlet_boards_owner ON public.padlet_boards(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.padlet_boards TO authenticated;
GRANT ALL ON public.padlet_boards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.padlet_notes TO authenticated;
GRANT ALL ON public.padlet_notes TO service_role;

ALTER TABLE public.padlet_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.padlet_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boards viewable by authenticated"
ON public.padlet_boards FOR SELECT TO authenticated USING (true);

CREATE POLICY "teachers can create boards"
ON public.padlet_boards FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = owner_id AND (
    public.has_role(auth.uid(), 'teacher') OR
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'director')
  )
);

CREATE POLICY "owners or admins update boards"
ON public.padlet_boards FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'director')
);

CREATE POLICY "owners or admins delete boards"
ON public.padlet_boards FOR DELETE TO authenticated
USING (
  owner_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'director')
);

CREATE POLICY "notes viewable by authenticated"
ON public.padlet_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated can post notes"
ON public.padlet_notes FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id AND
  EXISTS (
    SELECT 1 FROM public.padlet_boards b
    WHERE b.id = board_id AND (b.allow_guest_post = true OR b.owner_id = auth.uid())
  )
);

CREATE POLICY "authors or board owners update notes"
ON public.padlet_notes FOR UPDATE TO authenticated
USING (
  author_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.padlet_boards b WHERE b.id = board_id AND b.owner_id = auth.uid()) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'director')
);

CREATE POLICY "authors or board owners delete notes"
ON public.padlet_notes FOR DELETE TO authenticated
USING (
  author_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.padlet_boards b WHERE b.id = board_id AND b.owner_id = auth.uid()) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'director')
);

CREATE TRIGGER update_padlet_boards_updated_at BEFORE UPDATE ON public.padlet_boards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_padlet_notes_updated_at BEFORE UPDATE ON public.padlet_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.padlet_boards REPLICA IDENTITY FULL;
ALTER TABLE public.padlet_notes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.padlet_boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.padlet_notes;

CREATE POLICY "padlet read authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'padlet');

CREATE POLICY "padlet upload authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'padlet');

CREATE POLICY "padlet delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'padlet' AND owner = auth.uid());
