
-- Add created_by column to documents table
ALTER TABLE public.documents ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add recipient_user_id tracking for personnel-targeted docs
-- (column already exists in document_recipients)
