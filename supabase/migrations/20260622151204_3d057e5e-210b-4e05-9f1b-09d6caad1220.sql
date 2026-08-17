
-- 1) Remove google_chat_webhooks from realtime publication if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'google_chat_webhooks'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.google_chat_webhooks';
  END IF;
END $$;

-- 2) Drop overly broad realtime.messages policies
DROP POLICY IF EXISTS "Authenticated can broadcast realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can read realtime" ON realtime.messages;

-- Re-assert deny-by-default (postgres_changes paths remain RLS-checked on source tables)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all realtime broadcast/presence by default" ON realtime.messages;
DROP POLICY IF EXISTS "Deny all realtime broadcast/presence by default" ON realtime.messages;
CREATE POLICY "Deny all realtime broadcast/presence by default"
ON realtime.messages
FOR SELECT
TO authenticated
USING (false);

DROP POLICY IF EXISTS "Deny all realtime inserts by default" ON realtime.messages;
DROP POLICY IF EXISTS "Deny all realtime inserts by default" ON realtime.messages;
CREATE POLICY "Deny all realtime inserts by default"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (false);
