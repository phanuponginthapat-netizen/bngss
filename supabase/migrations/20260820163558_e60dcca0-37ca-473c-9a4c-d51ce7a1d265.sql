DROP POLICY IF EXISTS "chat attachments read own" ON storage.objects;
CREATE POLICY "chat attachments read own" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "user can join / creator can add" ON public.chat_participants;
CREATE POLICY "user can join / creator can add" ON public.chat_participants
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = chat_participants.conversation_id
      AND c.created_by = auth.uid()
  )
  OR public.is_chat_admin(chat_participants.conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "homework files read auth" ON storage.objects;
CREATE POLICY "homework files read auth" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'homework-files' AND owner = auth.uid());

DROP POLICY IF EXISTS "task attach read" ON storage.objects;
CREATE POLICY "task attach read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "kiosk health read authenticated" ON public.kiosk_health_samples;
DROP POLICY IF EXISTS "kiosk health insert authenticated" ON public.kiosk_health_samples;

CREATE POLICY "kiosk health read authenticated" ON public.kiosk_health_samples
FOR SELECT TO authenticated
USING (
  public.is_staff_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.kiosk_devices kd
    WHERE kd.device_id = kiosk_health_samples.device_id
      AND kd.user_id = auth.uid()
  )
);

CREATE POLICY "kiosk health insert authenticated" ON public.kiosk_health_samples
FOR INSERT TO authenticated
WITH CHECK (
  public.is_staff_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.kiosk_devices kd
    WHERE kd.device_id = kiosk_health_samples.device_id
      AND kd.user_id = auth.uid()
  )
);