
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DROP POLICY IF EXISTS "Deny all client access" ON public.webauthn_challenges;
CREATE POLICY "Deny all client access"
ON public.webauthn_challenges
AS PERMISSIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert their own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS app_update_staff ON public.club_applications;
CREATE POLICY app_update_staff
ON public.club_applications
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
  OR public.is_club_advisor(club_id, auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
  OR public.is_club_advisor(club_id, auth.uid())
);
