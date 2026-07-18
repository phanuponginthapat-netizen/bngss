import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

export type ChatConversation = {
  id: string;
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  last_message_at: string;
  last_message_preview: string | null;
};

export type ChatParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string;
  last_read_at: string;
  is_muted: boolean;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  attachments: Array<{ url: string; name: string; type: string; size: number }>;
  reply_to: string | null;
  is_deleted: boolean;
  created_at: string;
};

/** All conversations current user is a member of, with participants + peers. */
export function useConversations() {
  const { userId } = useUserRole();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["chat_conversations", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: parts } = await supabase
        .from("chat_participants")
        .select("conversation_id, last_read_at, is_muted")
        .eq("user_id", userId!);
      const ids = (parts || []).map((p) => p.conversation_id);
      if (!ids.length) return [] as (ChatConversation & { my_last_read_at: string; is_muted: boolean; participants: any[] })[];

      const [{ data: convs }, { data: allParts }] = await Promise.all([
        supabase.from("chat_conversations").select("*").in("id", ids).order("last_message_at", { ascending: false }),
        supabase.from("chat_participants").select("*").in("conversation_id", ids),
      ]);

      // fetch peer profiles
      const otherIds = Array.from(new Set((allParts || []).map((p: any) => p.user_id).filter((x: string) => x !== userId)));
      const { data: profiles } = otherIds.length
        ? await supabase.rpc("get_chat_user_profiles", { _ids: otherIds })
        : { data: [] as any[] };
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const myPartMap = new Map((parts || []).map((p: any) => [p.conversation_id, p]));
      return (convs || []).map((c: any) => {
        const my = myPartMap.get(c.id);
        const pList = (allParts || []).filter((p: any) => p.conversation_id === c.id).map((p: any) => ({
          ...p, profile: profileMap.get(p.user_id) || null,
        }));
        return { ...c, my_last_read_at: my?.last_read_at, is_muted: !!my?.is_muted, participants: pList };
      });
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`chat-conv-${userId}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["chat_conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_participants", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chat_conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  return q;
}

/** Total unread across all conversations. */
export function useChatUnread() {
  const { data } = useConversations();
  return useMemo(() => {
    if (!data) return 0;
    let n = 0;
    for (const c of data) {
      // unread if last_message_at > my_last_read_at
      if (c.last_message_at && c.my_last_read_at && new Date(c.last_message_at) > new Date(c.my_last_read_at)) n++;
    }
    return n;
  }, [data]);
}

/** Messages of one conversation with realtime append. */
export function useMessages(conversationId: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["chat_messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data || []) as any as ChatMessage[];
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`chat-msg-${conversationId}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["chat_messages", conversationId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, qc]);

  return q;
}

export function useMarkRead() {
  const { userId } = useUserRole();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      if (!userId) return;
      await supabase
        .from("chat_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_conversations"] }),
  });
}

export function useSendMessage() {
  const { userId } = useUserRole();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { conversationId: string; content: string; attachments?: ChatMessage["attachments"] }) => {
      if (!userId) throw new Error("no user");
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: args.conversationId,
        sender_id: userId,
        content: args.content || null,
        attachments: args.attachments || [],
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["chat_messages", v.conversationId] });
      qc.invalidateQueries({ queryKey: ["chat_conversations"] });
    },
  });
}

/** Create 1:1 conversation (idempotent) or a group. */
export function useCreateConversation() {
  const { userId } = useUserRole();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { userIds: string[]; name?: string; isGroup?: boolean }) => {
      if (!userId) throw new Error("no user");
      const others = args.userIds.filter((u) => u !== userId);
      if (!others.length) throw new Error("ต้องเลือกอย่างน้อย 1 คน");
      const isGroup = args.isGroup || others.length > 1;

      // For 1:1, try to find existing
      if (!isGroup) {
        const { data: mine } = await supabase.from("chat_participants").select("conversation_id").eq("user_id", userId);
        const { data: theirs } = await supabase.from("chat_participants").select("conversation_id").eq("user_id", others[0]);
        const myIds = new Set((mine || []).map((r: any) => r.conversation_id));
        const shared = (theirs || []).map((r: any) => r.conversation_id).filter((id: string) => myIds.has(id));
        if (shared.length) {
          const { data: existing } = await supabase.from("chat_conversations").select("*").in("id", shared).eq("is_group", false).limit(1);
          if (existing && existing.length) return existing[0].id as string;
        }
      }

      const { data: conv, error } = await supabase
        .from("chat_conversations")
        .insert({ is_group: isGroup, name: isGroup ? args.name || "กลุ่มแชท" : null, created_by: userId })
        .select()
        .single();
      if (error) throw error;

      const rows = [userId, ...others].map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
        role: uid === userId ? "admin" : "member",
      }));
      const { error: pe } = await supabase.from("chat_participants").insert(rows);
      if (pe) throw pe;
      return conv.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_conversations"] }),
  });
}

export function useBlockedIds() {
  const { userId } = useUserRole();
  const q = useQuery({
    queryKey: ["chat_blocks", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from("chat_blocks").select("blocked_id").eq("blocker_id", userId!);
      return new Set((data || []).map((r: any) => r.blocked_id as string));
    },
  });
  return q.data || new Set<string>();
}
