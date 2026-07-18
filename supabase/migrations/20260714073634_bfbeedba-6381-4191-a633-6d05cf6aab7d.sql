
DROP POLICY IF EXISTS "auth users read chat files" ON storage.objects;

CREATE POLICY "chat participants read chat files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND (
    -- own uploads
    (storage.foldername(name))[1] = (auth.uid())::text
    -- or participant of the conversation encoded as folder[2]
    OR EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.conversation_id::text = (storage.foldername(name))[2]
        AND cp.user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);
