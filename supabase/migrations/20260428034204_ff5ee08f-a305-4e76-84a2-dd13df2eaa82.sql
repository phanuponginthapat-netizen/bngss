-- Tighten salary_records SELECT policy
DROP POLICY IF EXISTS "Auth users can view salary_records" ON public.salary_records;

CREATE POLICY "Owner or admin/director can view salary_records"
ON public.salary_records
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.personnel p
    WHERE p.id = salary_records.personnel_id
      AND p.user_id = auth.uid()
  )
);

-- Realtime.messages: deny-by-default. Add an explicit empty policy so authenticated users
-- cannot subscribe broadly. Apps that need realtime should use postgres_changes (RLS-checked).
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all realtime broadcast/presence by default" ON realtime.messages;
CREATE POLICY "Deny all realtime broadcast/presence by default"
ON realtime.messages
FOR SELECT
TO authenticated
USING (false);

DROP POLICY IF EXISTS "Deny all realtime inserts by default" ON realtime.messages;
CREATE POLICY "Deny all realtime inserts by default"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (false);