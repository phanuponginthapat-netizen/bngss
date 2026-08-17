
-- Create document_recipients table for tracking who receives each document
CREATE TABLE IF NOT EXISTS public.document_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  recipient_type text NOT NULL DEFAULT 'department',
  recipient_name text NOT NULL,
  recipient_user_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.document_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth users manage document_recipients" ON public.document_recipients;
CREATE POLICY "Auth users manage document_recipients"
  ON public.document_recipients FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
