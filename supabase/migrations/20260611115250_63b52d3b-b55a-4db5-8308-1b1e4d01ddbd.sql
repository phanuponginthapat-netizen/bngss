-- Fix: audit_logs INSERT was blocked by RLS, causing client-side logAudit() to fail
CREATE POLICY "Users can insert their own audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow service_role / edge functions to insert any
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);