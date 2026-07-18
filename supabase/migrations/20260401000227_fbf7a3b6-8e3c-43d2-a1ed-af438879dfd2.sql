
-- Add file_url column to documents table for file attachments
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_name text;
