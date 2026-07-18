CREATE OR REPLACE FUNCTION public.tr_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

REVOKE SELECT ON public.social_posts FROM anon;
REVOKE SELECT ON public.social_posts FROM authenticated;
GRANT SELECT (id, platform, external_id, page_id, content, media_urls, thumbnail_url, permalink, posted_at, fetched_at, broadcasted_at, created_at)
  ON public.social_posts TO anon, authenticated;