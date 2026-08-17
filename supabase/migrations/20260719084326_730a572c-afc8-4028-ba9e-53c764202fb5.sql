
CREATE TABLE IF NOT EXISTS public.line_vault_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_group_id text NOT NULL UNIQUE,
  group_name text NOT NULL,
  department public.school_department NULL,
  default_visibility text NOT NULL DEFAULT 'everyone' CHECK (default_visibility IN ('everyone','department','admin')),
  auto_capture boolean NOT NULL DEFAULT true,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_vault_groups TO authenticated;
GRANT ALL ON public.line_vault_groups TO service_role;
ALTER TABLE public.line_vault_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vault_groups_admin_all" ON public.line_vault_groups;
CREATE POLICY "vault_groups_admin_all" ON public.line_vault_groups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'school_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'school_admin'));

DROP POLICY IF EXISTS "vault_groups_read_authenticated" ON public.line_vault_groups;
CREATE POLICY "vault_groups_read_authenticated" ON public.line_vault_groups
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.line_vault_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('line','manual')),
  kind text NOT NULL CHECK (kind IN ('photo','file','note')),
  title text NOT NULL,
  description text NULL,
  note_text text NULL,
  storage_path text NULL,
  mime_type text NULL,
  size_bytes bigint NULL,
  original_filename text NULL,
  thumbnail_path text NULL,
  line_group_id text NULL,
  line_message_id text NULL,
  line_sender_user_id text NULL,
  line_sender_name text NULL,
  department public.school_department NULL,
  visibility text NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone','department','admin')),
  tags text[] NOT NULL DEFAULT '{}'::text[],
  uploaded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(line_message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.line_vault_items TO authenticated;
GRANT ALL ON public.line_vault_items TO service_role;
ALTER TABLE public.line_vault_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS line_vault_items_kind_idx ON public.line_vault_items(kind);
CREATE INDEX IF NOT EXISTS line_vault_items_created_idx ON public.line_vault_items(created_at DESC);
CREATE INDEX IF NOT EXISTS line_vault_items_group_idx ON public.line_vault_items(line_group_id);
CREATE INDEX IF NOT EXISTS line_vault_items_dept_idx ON public.line_vault_items(department);

CREATE OR REPLACE FUNCTION public.user_in_school_department(_dept public.school_department)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_departments ud
    WHERE ud.user_id = auth.uid() AND ud.department = _dept
  );
$$;

DROP POLICY IF EXISTS "vault_items_admin_all" ON public.line_vault_items;
CREATE POLICY "vault_items_admin_all" ON public.line_vault_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'school_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'school_admin'));

DROP POLICY IF EXISTS "vault_items_read_everyone" ON public.line_vault_items;
CREATE POLICY "vault_items_read_everyone" ON public.line_vault_items
  FOR SELECT TO authenticated
  USING (visibility = 'everyone');

DROP POLICY IF EXISTS "vault_items_read_department" ON public.line_vault_items;
CREATE POLICY "vault_items_read_department" ON public.line_vault_items
  FOR SELECT TO authenticated
  USING (visibility = 'department' AND department IS NOT NULL AND public.user_in_school_department(department));

DROP TRIGGER IF EXISTS trg_line_vault_items_updated ON public.line_vault_items;
CREATE TRIGGER trg_line_vault_items_updated
  BEFORE UPDATE ON public.line_vault_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_line_vault_groups_updated ON public.line_vault_groups;
CREATE TRIGGER trg_line_vault_groups_updated
  BEFORE UPDATE ON public.line_vault_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "line-vault admin manage" ON storage.objects;
CREATE POLICY "line-vault admin manage"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'line-vault' AND (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'super_admin') OR
    public.has_role(auth.uid(),'school_admin')
  )
)
WITH CHECK (
  bucket_id = 'line-vault' AND (
    public.has_role(auth.uid(),'admin') OR
    public.has_role(auth.uid(),'super_admin') OR
    public.has_role(auth.uid(),'school_admin')
  )
);

DROP POLICY IF EXISTS "line-vault authenticated read via row" ON storage.objects;
CREATE POLICY "line-vault authenticated read via row"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'line-vault' AND EXISTS (
    SELECT 1 FROM public.line_vault_items i
    WHERE i.storage_path = storage.objects.name
  )
);
