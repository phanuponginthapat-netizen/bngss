-- Deduplicate existing labels per provider before adding constraint
WITH ranked AS (
  SELECT id, provider_type, label,
         ROW_NUMBER() OVER (PARTITION BY provider_type, lower(label) ORDER BY created_at) AS rn
  FROM public.ai_provider_keys
  WHERE label IS NOT NULL
)
UPDATE public.ai_provider_keys k
SET label = k.label || '-' || r.rn
FROM ranked r
WHERE k.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_keys_provider_label_uniq
  ON public.ai_provider_keys (provider_type, lower(label))
  WHERE label IS NOT NULL;