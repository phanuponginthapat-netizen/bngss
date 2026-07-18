
DROP POLICY IF EXISTS "participants can view conversation" ON public.chat_conversations;
CREATE POLICY "participants or creator can view conversation"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (created_by = auth.uid() OR public.is_chat_participant(id, auth.uid()));
