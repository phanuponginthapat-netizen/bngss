-- Add created_by column to documents table
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Add recipient_user_id tracking for personnel-targeted docs
-- (column already exists in document_recipients)
