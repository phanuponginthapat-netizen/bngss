DELETE FROM public.cms_menu_items a
USING public.cms_menu_items b
WHERE a.url IS NOT DISTINCT FROM b.url
  AND a.label = b.label
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS cms_menu_items_label_url_uniq
  ON public.cms_menu_items (label, coalesce(url, ''));