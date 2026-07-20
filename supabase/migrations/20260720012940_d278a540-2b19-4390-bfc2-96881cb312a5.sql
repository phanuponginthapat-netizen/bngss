-- Backfill: propagate any caption to every photo in the same LINE image album,
-- so albums show their caption regardless of which photo becomes the cover.
UPDATE public.line_vault_items AS tgt
SET description = src.description,
    note_text  = COALESCE(tgt.note_text, src.description),
    title      = COALESCE(NULLIF(tgt.title, ''), split_part(src.description, E'\n', 1))
FROM public.line_vault_items AS src
WHERE tgt.line_image_set_id IS NOT NULL
  AND tgt.line_image_set_id = src.line_image_set_id
  AND tgt.line_group_id = src.line_group_id
  AND src.description IS NOT NULL AND src.description <> ''
  AND (tgt.description IS NULL OR tgt.description = '')
  AND tgt.id <> src.id;