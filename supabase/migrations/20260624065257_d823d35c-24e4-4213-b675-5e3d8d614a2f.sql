DROP POLICY IF EXISTS "Auth view all cms settings" ON public.cms_settings;

DROP POLICY IF EXISTS "Auth view non-sensitive cms settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Auth view non-sensitive cms settings" ON public.cms_settings;
CREATE POLICY "Auth view non-sensitive cms settings"
ON public.cms_settings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR (
    (key !~~* 'id_card%')
    AND (key !~~* '%template%')
    AND (key !~~* '%secret%')
    AND (key !~~* '%internal%')
    AND (key !~~* 'admin_%')
    AND (key !~~* '%ai_bot%')
    AND (key !~~* '%webhook%')
    AND (key !~~* '%api_key%')
    AND (key !~~* '%token%')
  )
);