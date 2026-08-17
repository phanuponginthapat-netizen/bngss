-- Lock down Realtime channel subscriptions: only authenticated users can subscribe.
-- Combined with the publication filter (sensitive PII tables removed) this prevents
-- anonymous clients from receiving any row-change payload at all.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can read realtime" ON realtime.messages;
CREATE POLICY "Authenticated can read realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can broadcast realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can broadcast realtime" ON realtime.messages;
CREATE POLICY "Authenticated can broadcast realtime"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);