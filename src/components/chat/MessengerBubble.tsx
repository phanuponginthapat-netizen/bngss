import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Plus, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConversations, useChatUnread, useCreateConversation } from "@/hooks/useChat";
import { useUserRole } from "@/hooks/useUserRole";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { supabase } from "@/integrations/supabase/client";
import { NewChatDialog } from "./NewChatDialog";
import { ChatWindow } from "./ChatWindow";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OpenWindow { id: string; minimized: boolean; }

const STORAGE_KEY = "chat_open_windows_v1";

function loadWindows(): OpenWindow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x: any) => x && typeof x.id === "string")
      .map((x: any) => ({ id: x.id, minimized: true })) // always restore as minimized bubble
      .slice(0, 6);
  } catch {
    return [];
  }
}

export function MessengerBubble() {
  const { userId } = useUserRole();
  const { data: conversations = [] } = useConversations();
  const unread = useChatUnread();
  const { isOnline } = useOnlinePresence();
  const create = useCreateConversation();
  const [panelOpen, setPanelOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [startingUserId, setStartingUserId] = useState<string | null>(null);
  const [windows, setWindows] = useState<OpenWindow[]>(() => loadWindows());

  // Persist across refreshes — stays until user explicitly closes it
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(windows));
    } catch {
      /* ignore quota */
    }
  }, [windows]);

  // Expose minimized-bubble count so AiChatBubble can shift itself up
  const minimizedCount = windows.filter((w) => w.minimized).length;
  useEffect(() => {
    document.documentElement.style.setProperty("--chat-stack", String(minimizedCount));
    return () => {
      document.documentElement.style.setProperty("--chat-stack", "0");
    };
  }, [minimizedCount]);

  // 🔔 Realtime toast for any new chat message across all my conversations
  // (fires only when the sender isn't me and the chat window for that conv isn't currently focused/open non-minimized)
  useEffect(() => {
    if (!userId) return;
    const convIds = conversations.map((c: any) => c.id);
    if (!convIds.length) return;
    const ch = supabase
      .channel(`chat-global-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=in.(${convIds.join(",")})` },
        (payload: any) => {
          const msg = payload.new;
          if (!msg || msg.sender_id === userId) return;
          const conv: any = conversations.find((c: any) => c.id === msg.conversation_id);
          if (!conv) return;
          // Skip toast if the window is open and not minimized (user is already looking at it)
          const openWin = windows.find((w) => w.id === msg.conversation_id);
          if (openWin && !openWin.minimized) return;
          if (conv.is_muted) return;
          const peer = (conv.participants || []).find((p: any) => p.user_id === msg.sender_id);
          const senderName = conv.is_group
            ? `${conv.name || "กลุ่ม"} · ${peer?.profile?.first_name || "ผู้ใช้"}`
            : `${peer?.profile?.first_name || ""} ${peer?.profile?.last_name || ""}`.trim() || "ข้อความใหม่";
          const preview = (msg.content || "📎 ไฟล์แนบ").slice(0, 80);
          toast(senderName, {
            description: preview,
            action: { label: "เปิด", onClick: () => openChat(msg.conversation_id) },
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, conversations.map((c: any) => c.id).join(","), windows]);


  const openChat = (id: string) => {
    setPanelOpen(false);
    setSearch("");
    setWindows((w) => {
      if (w.find((x) => x.id === id)) return w.map((x) => (x.id === id ? { ...x, minimized: false } : x));
      const kept = w.slice(-2); // max 3 windows on desktop
      return [...kept, { id, minimized: false }];
    });
  };

  const trimmedSearch = search.trim();
  const { data: userResults = [], isLoading: usersLoading } = useQuery({
    queryKey: ["chat_panel_user_search", trimmedSearch],
    enabled: !!userId && panelOpen,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_chat_users", { _term: trimmedSearch });
      if (error) {
        console.error(error);
        return [];
      }
      return data || [];
    },
  });

  if (!userId) return null;

  const startChatWithUser = async (user: any) => {
    try {
      setStartingUserId(user.id);
      const convId = await create.mutateAsync({ userIds: [user.id] });
      openChat(convId);
    } catch (e: any) {
      toast.error(e.message || "เริ่มแชทไม่สำเร็จ");
    } finally {
      setStartingUserId(null);
    }
  };

  const filtered = conversations.filter((c: any) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    if (c.name?.toLowerCase().includes(term)) return true;
    return (c.participants || []).some((p: any) => {
      const n = `${p.profile?.first_name || ""} ${p.profile?.last_name || ""} ${p.profile?.nickname || ""} ${p.profile?.student_code || ""} ${p.profile?.employee_code || ""}`.toLowerCase();
      return n.includes(term);
    });
  });
  const showUserSearch = trimmedSearch.length > 0;
  const panelUserResults = [...(userResults as any[])].sort((a, b) => {
    const ao = isOnline(a.id) ? 0 : 1;
    const bo = isOnline(b.id) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return (a.rank_score ?? 999) - (b.rank_score ?? 999);
  });

  const minimizedIds = windows.filter((w) => w.minimized).map((w) => w.id);


  return (
    <>
      {/* Windows */}
      {windows.map((w, i) => {
        const conv = conversations.find((c: any) => c.id === w.id);
        if (!conv) return null;
        const minIndex = w.minimized ? minimizedIds.indexOf(w.id) : -1;
        return (
          <ChatWindow
            key={w.id}
            conversation={conv}
            minimized={w.minimized}
            offsetIndex={i}
            minimizedIndex={minIndex}
            onMinimize={() => setWindows((ws) => ws.map((x) => (x.id === w.id ? { ...x, minimized: !x.minimized } : x)))}
            onClose={() => setWindows((ws) => ws.filter((x) => x.id !== w.id))}
          />
        );
      })}

      {/* Floating bubble button — sits BELOW AiChatBubble, same visual size */}
      <button
        onClick={() => setPanelOpen((v) => !v)}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        className="fixed right-3 md:right-6 z-40 group p-0"
        aria-label="กล่องแชท"
      >
        <span className="relative block w-11 h-11 rounded-full bg-primary text-primary-foreground border-[2.5px] border-white ring-2 ring-foreground/80 shadow-[3px_3px_0_hsl(var(--foreground))] hover:scale-110 hover:-rotate-6 active:scale-95 transition-transform flex items-center justify-center overflow-hidden">
          <MessageCircle className="w-5 h-5" />
        </span>
        {unread > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] ring-2 ring-white">
            {unread > 99 ? "99+" : unread}
          </Badge>
        )}
      </button>

      {/* Panel — responsive: full-width phone, 320px tablet+/desktop; height caps to viewport */}
      {panelOpen && (
        <div
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 68px)" }}
          className="fixed right-3 md:right-6 z-40 w-[calc(100vw-1.5rem)] sm:w-[340px] md:w-80 h-[min(500px,calc(100vh-6rem))] bg-card border rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up"
        >
          <div className="flex items-center gap-2 p-3 border-b">
            <MessageCircle className="w-5 h-5 text-primary" />
            <div className="flex-1 font-semibold">แชท</div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setNewChatOpen(true)} title="เริ่มแชทใหม่">
              <Plus className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setPanelOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ / รหัส เพื่อเริ่มแชท…" className="pl-9 h-9 text-sm" autoFocus />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-1">
              {filtered.length > 0 && (
                <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">แชทเดิม</div>
              )}
              {filtered.map((c: any) => {
                  const peers = c.participants.filter((p: any) => p.user_id !== userId);
                  const peer = peers[0];
                  const title = c.is_group
                    ? c.name || `กลุ่ม (${c.participants.length})`
                    : peer?.profile
                      ? `${peer.profile.first_name || ""} ${peer.profile.last_name || ""}`.trim() || "ผู้ใช้"
                      : "แชท";
                  const avatar = c.is_group ? c.avatar_url : peer?.profile?.avatar_url;
                  const online = !c.is_group && peer && isOnline(peer.user_id);
                  const isUnread = c.last_message_at && c.my_last_read_at && new Date(c.last_message_at) > new Date(c.my_last_read_at);
                  return (
                    <button
                      key={c.id}
                      onClick={() => openChat(c.id)}
                      className={cn("w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted text-left", isUnread && "bg-primary/5")}
                    >
                      <div className="relative">
                        <Avatar className="w-11 h-11">
                          <AvatarImage src={avatar || undefined} />
                          <AvatarFallback>{title.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        {online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success ring-2 ring-card" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-sm truncate", isUnread ? "font-semibold" : "font-medium")}>{title}</div>
                        <div className={cn("text-xs truncate", isUnread ? "text-foreground" : "text-muted-foreground")}>
                          {c.last_message_preview || "เริ่มบทสนทนา"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground">
                          {c.last_message_at && formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: th })}
                        </span>
                        {isUnread && <span className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                    </button>
                  );
                })}

              <div className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {showUserSearch ? "ผู้ใช้ในโรงเรียน" : "เริ่มแชทใหม่กับ"}
              </div>
              {usersLoading ? (
                <div className="text-center py-6 text-sm text-muted-foreground">กำลังโหลดผู้ใช้…</div>
              ) : panelUserResults.length > 0 ? (
                panelUserResults.map((u: any) => {
                  const name = `${u.first_name || ""} ${u.last_name || ""}`.trim() || "ผู้ใช้";
                  const code = u.student_code || u.employee_code;
                  const disabled = startingUserId === u.id || create.isPending;
                  const online = isOnline(u.id);
                  const roleLabel = u.role === "teacher" ? "ครู" : u.role === "student" ? "นักเรียน" : u.role === "admin" ? "ผู้ดูแล" : u.role === "director" ? "ผู้บริหาร" : u.role === "parent" ? "ผู้ปกครอง" : "";
                  return (
                    <button
                      key={u.id}
                      onClick={() => startChatWithUser(u)}
                      disabled={disabled}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted disabled:opacity-60 disabled:cursor-wait text-left"
                    >
                      <div className="relative">
                        <Avatar className="w-11 h-11">
                          <AvatarImage src={u.avatar_url || undefined} />
                          <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        {online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success ring-2 ring-card" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}{u.nickname ? ` (${u.nickname})` : ""}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[roleLabel, u.department, code].filter(Boolean).join(" • ")}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                    </button>
                  );
                })
              ) : showUserSearch ? (
                <div className="text-center py-6 text-sm text-muted-foreground">ไม่พบผู้ใช้ที่ค้นหา</div>
              ) : null}
            </div>
          </ScrollArea>
          <div className="p-2 border-t text-[10px] text-muted-foreground text-center">
            ข้อความและไฟล์จะถูกลบอัตโนมัติหลัง 30 วัน
          </div>
        </div>
      )}

      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} onCreated={openChat} />
    </>
  );
}
