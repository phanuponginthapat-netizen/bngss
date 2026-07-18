
-- ============ CHAT / MESSENGER SYSTEM ============

-- Conversations (1:1 or group)
CREATE TABLE public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN NOT NULL DEFAULT false,
  name TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

-- Participants
CREATE TABLE public.chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- member | admin
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_muted BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);
CREATE INDEX idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX idx_chat_participants_conv ON public.chat_participants(conversation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_participants TO authenticated;
GRANT ALL ON public.chat_participants TO service_role;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- Messages (kept only 30 days)
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{url, name, type, size}]
  reply_to UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_conv_created ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Blocks
CREATE TABLE public.chat_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
CREATE INDEX idx_chat_blocks_blocker ON public.chat_blocks(blocker_id);
GRANT SELECT, INSERT, DELETE ON public.chat_blocks TO authenticated;
GRANT ALL ON public.chat_blocks TO service_role;
ALTER TABLE public.chat_blocks ENABLE ROW LEVEL SECURITY;

-- Reports
CREATE TABLE public.chat_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE SET NULL,
  reporter_id UUID NOT NULL,
  reported_user_id UUID,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | reviewed | dismissed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.chat_reports TO authenticated;
GRANT ALL ON public.chat_reports TO service_role;
ALTER TABLE public.chat_reports ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.is_chat_participant(_conv UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = _conv AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.is_chat_admin(_conv UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_participants WHERE conversation_id = _conv AND user_id = _user AND role = 'admin');
$$;

-- ============ RLS POLICIES ============
-- conversations
CREATE POLICY "participants can view conversation" ON public.chat_conversations
  FOR SELECT TO authenticated USING (public.is_chat_participant(id, auth.uid()));
CREATE POLICY "any auth can create conversation" ON public.chat_conversations
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "chat admin can update" ON public.chat_conversations
  FOR UPDATE TO authenticated USING (public.is_chat_admin(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "creator can delete" ON public.chat_conversations
  FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- participants
CREATE POLICY "user sees own memberships" ON public.chat_participants
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR public.is_chat_participant(conversation_id, auth.uid())
  );
CREATE POLICY "user can join / creator can add" ON public.chat_participants
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
    OR public.is_chat_admin(conversation_id, auth.uid())
  );
CREATE POLICY "user updates own membership" ON public.chat_participants
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_chat_admin(conversation_id, auth.uid()));
CREATE POLICY "user leaves / admin removes" ON public.chat_participants
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_chat_admin(conversation_id, auth.uid()));

-- messages
CREATE POLICY "participants view messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (public.is_chat_participant(conversation_id, auth.uid()));
CREATE POLICY "participants send messages" ON public.chat_messages
  FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_chat_participant(conversation_id, auth.uid()));
CREATE POLICY "sender edits own message" ON public.chat_messages
  FOR UPDATE TO authenticated USING (sender_id = auth.uid());
CREATE POLICY "sender deletes own / admin deletes" ON public.chat_messages
  FOR DELETE TO authenticated USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- blocks
CREATE POLICY "user manages own blocks" ON public.chat_blocks
  FOR ALL TO authenticated USING (blocker_id = auth.uid()) WITH CHECK (blocker_id = auth.uid());

-- reports
CREATE POLICY "user creates report" ON public.chat_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reporter sees own / admin sees all" ON public.chat_reports
  FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin updates reports" ON public.chat_reports
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ TRIGGERS: update conversation last_message ============
CREATE OR REPLACE FUNCTION public.update_conv_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_conversations
     SET last_message_at = NEW.created_at,
         last_message_preview = LEFT(COALESCE(NEW.content, '[แนบไฟล์]'), 200),
         updated_at = now()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_chat_msg_last AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conv_last_message();

-- updated_at trigger for conversations
CREATE TRIGGER trg_chat_conv_updated BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.chat_participants REPLICA IDENTITY FULL;
