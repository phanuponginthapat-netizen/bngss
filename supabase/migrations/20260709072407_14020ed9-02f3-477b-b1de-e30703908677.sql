ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.documents
SET file_urls = jsonb_build_array(jsonb_build_object('path', file_url, 'name', COALESCE(file_name, file_url)))
WHERE file_url IS NOT NULL AND file_url <> '' AND (file_urls IS NULL OR file_urls = '[]'::jsonb);