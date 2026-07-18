import { useEffect, useMemo, useRef, useState } from "react";
import { X, Minus, Send, Paperclip, Image as ImageIcon, MoreVertical, Flag, Ban, Trash2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMessages, useSendMessage, useMarkRead, ChatMessage } from "@/hooks/useChat";
import { useUserRole } from "@/hooks/useUserRole";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_SIZE = 10 * 1024 * 1024;

interface Props {
  conversation: any;
  minimized: boolean;
  onMinimize: () => void;
  onClose: () => void;
  offsetIndex: number;
  minimizedIndex?: number;
}

export function ChatWindow({ conversation, minimized, onMinimize, onClose, offsetIndex, minimizedIndex = 0 }: Props) {
  const { userId } = useUserRole();
  const { data: messages = [] } = useMessages(conversation.id);
  const send = useSendMessage();
  const markRead = useMarkRead();
  const { isOnline } = useOnlinePresence();
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const peers = (conversation.participants || []).filter((p: any) => p.user_id !== userId);
  const peer = peers[0];
  const title = conversation.is_group
    ? conversation.name || `กลุ่ม (${(conversation.participants || []).length})`
    : peer?.profile
      ? `${peer.profile.first_name || ""} ${peer.profile.last_name || ""}`.trim() || "ผู้ใช้"
      : "แชท";
  const avatar = conversation.is_group ? conversation.avatar_url : peer?.profile?.avatar_url;
  const peerOnline = !conversation.is_group && peer && isOnline(peer.user_id);

  // Auto scroll & mark read
  useEffect(() => {
    if (!minimized) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      markRead.mutate(conversation.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, minimized]);

  const readByOthers = useMemo(() => {
    // last message from me: show "อ่านแล้ว" if any other participant last_read_at >= msg.created_at
    const mine = [...messages].reverse().find((m) => m.sender_id === userId);
    if (!mine) return false;
    return (conversation.participants || []).some(
      (p: any) => p.user_id !== userId && p.last_read_at && new Date(p.last_read_at) >= new Date(mine.created_at),
    );
  }, [messages, conversation.participants, userId]);

  const doSend = async () => {
    if (!text.trim() && !uploading) return;
    const t = text.trim();
    setText("");
    try {
      await send.mutateAsync({ conversationId: conversation.id, content: t });
    } catch (e: any) {
      toast.error(e.message || "ส่งไม่สำเร็จ");
      setText(t);
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!userId) return;
    for (const f of files) {
      if (f.size > MAX_SIZE) { toast.error(`ไฟล์ ${f.name} เกิน 10MB`); continue; }
    }
    const ok = files.filter((f) => f.size <= MAX_SIZE);
    if (!ok.length) return;
    setUploading(true);
    try {
      const uploaded: any[] = [];
      for (const f of ok) {
        const path = `${userId}/${conversation.id}/${Date.now()}-${f.name}`;
        const { error } = await supabase.storage.from("chat-attachments").upload(path, f, { upsert: false });
        if (error) { toast.error(error.message); continue; }
        const { data: signed } = await supabase.storage.from("chat-attachments").createSignedUrl(path, 60 * 60 * 24 * 30);
        uploaded.push({ url: signed?.signedUrl || path, name: f.name, type: f.type, size: f.size, path });
      }
      if (uploaded.length) {
        await send.mutateAsync({ conversationId: conversation.id, content: "", attachments: uploaded });
      }
    } finally { setUploading(false); }
  };

  const doBlock = async () => {
    if (!peer || !userId) return;
    await supabase.from("chat_blocks").insert({ blocker_id: userId, blocked_id: peer.user_id });
    toast.success("บล็อกผู้ใช้แล้ว");
    onClose();
  };

  const reportMessage = async (msg: ChatMessage) => {
    if (!userId) return;
    const reason = window.prompt("เหตุผลในการรายงาน?");
    if (!reason) return;
    await supabase.from("chat_reports").insert({
      message_id: msg.id, conversation_id: conversation.id,
      reporter_id: userId, reported_user_id: msg.sender_id, reason,
    });
    toast.success("รายงานแล้ว ผู้ดูแลจะตรวจสอบ");
  };

  const deleteMessage = async (msg: ChatMessage) => {
    if (msg.sender_id !== userId) return;
    await supabase.from("chat_messages").update({ is_deleted: true, content: null, attachments: [] }).eq("id", msg.id);
  };

  const myPart = (conversation.participants || []).find((p: any) => p.user_id === userId);
  const hasUnread =
    conversation.last_message_at &&
    (!myPart?.last_read_at || new Date(conversation.last_message_at) > new Date(myPart.last_read_at));

  if (minimized) {
    // Stack above the Messenger bubble (which sits at bottom 72px mobile / 24px desktop),
    // spacing 52px per bubble (44px avatar + 8px gap). AI chat bubble sits above this stack.
    const stackStep = 52;
    const idx = Math.max(0, minimizedIndex);
    return (
      <button
        onClick={onMinimize}
        title={title}
        className="fixed right-3 md:right-6 z-40 group animate-fade-in-up"
        style={{
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 16px + ${(idx + 1) * stackStep}px)`,
        }}
        aria-label={`เปิดแชท ${title}`}
      >
        <span className="relative block w-11 h-11 rounded-full overflow-hidden border-[2.5px] border-white ring-2 ring-foreground/80 shadow-[3px_3px_0_hsl(var(--foreground))] hover:scale-110 active:scale-95 transition-transform">
          <Avatar className="w-full h-full rounded-full">
            <AvatarImage src={avatar || undefined} />
            <AvatarFallback className="text-xs">{title.slice(0, 2)}</AvatarFallback>
          </Avatar>
        </span>
        {peerOnline && (
          <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-white" />
        )}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-destructive ring-2 ring-white" />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-card border shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="ปิด"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </button>
    );
  }


  return (
    <div
      className={cn(
        "fixed z-40 bg-card border rounded-t-xl shadow-2xl flex flex-col overflow-hidden transition-all",
        "w-[calc(100vw-1rem)] sm:w-80 h-[440px] sm:h-[500px]",
      )}
      style={{
        // ยกขึ้นเหนือปุ่ม Messenger bubble (44px + gap) เพื่อไม่ให้ทับปุ่มส่ง
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 68px)",
        right: `calc(1rem + ${offsetIndex} * (20rem + 0.5rem))`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-primary/5 cursor-pointer flex-shrink-0" onClick={onMinimize}>
        <div className="relative">
          <Avatar className="w-8 h-8">
            <AvatarImage src={avatar || undefined} />
            <AvatarFallback className="text-xs">{title.slice(0, 2)}</AvatarFallback>
          </Avatar>
          {peerOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-card" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{title}</div>
          {!conversation.is_group && (
            <div className="text-[10px] text-muted-foreground">{peerOnline ? "ออนไลน์" : "ออฟไลน์"}</div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!conversation.is_group && peer && (
              <DropdownMenuItem onClick={doBlock} className="text-destructive">
                <Ban className="w-4 h-4 mr-2" /> บล็อกผู้ใช้นี้
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onMinimize(); }}>
          <Minus className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onClose(); }}>
          <X className="w-4 h-4" />
        </Button>
      </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-background">
            {messages.map((m) => {
              const mine = m.sender_id === userId;
              const p = (conversation.participants || []).find((x: any) => x.user_id === m.sender_id);
              return (
                <div key={m.id} className={cn("flex gap-1.5 items-end group", mine && "flex-row-reverse")}>
                  {!mine && (
                    <Avatar className="w-6 h-6 flex-shrink-0">
                      <AvatarImage src={p?.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-[9px]">{(p?.profile?.first_name || "?").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={cn("max-w-[75%] flex flex-col", mine && "items-end")}>
                    {m.is_deleted ? (
                      <div className="text-xs italic text-muted-foreground px-3 py-2 rounded-2xl bg-muted">ถูกลบแล้ว</div>
                    ) : (
                      <>
                        {m.content && (
                          <div className={cn(
                            "px-3 py-2 rounded-2xl text-sm break-words whitespace-pre-wrap",
                            mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm",
                          )}>
                            {m.content}
                          </div>
                        )}
                        {(m.attachments || []).map((a, i) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="mt-1 block">
                            {a.type?.startsWith("image/") ? (
                              <img src={a.url} alt={a.name} className="max-w-[200px] rounded-xl border" />
                            ) : a.type?.startsWith("video/") ? (
                              <video src={a.url} controls className="max-w-[220px] rounded-xl border" />
                            ) : (
                              <div className="px-3 py-2 rounded-xl bg-muted text-xs flex items-center gap-2 border">
                                <Paperclip className="w-3.5 h-3.5" /> {a.name}
                              </div>
                            )}
                          </a>
                        ))}
                      </>
                    )}
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">
                        {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: th })}
                      </span>
                      {!m.is_deleted && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground">
                              <MoreVertical className="w-3 h-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={mine ? "end" : "start"}>
                            {mine && (
                              <DropdownMenuItem onClick={() => deleteMessage(m)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> ลบข้อความ
                              </DropdownMenuItem>
                            )}
                            {!mine && (
                              <DropdownMenuItem onClick={() => reportMessage(m)}>
                                <Flag className="w-3.5 h-3.5 mr-2" /> รายงาน
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {readByOthers && messages.length > 0 && (
              <div className="text-[10px] text-muted-foreground text-right pr-1">อ่านแล้ว</div>
            )}
          </div>

          <div className="border-t p-2 flex items-end gap-1 bg-card flex-shrink-0">
            <input ref={imgRef} type="file" accept="image/*,video/*" multiple hidden
              onChange={(e) => { uploadFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
            <input ref={fileRef} type="file" multiple hidden
              onChange={(e) => { uploadFiles(Array.from(e.target.files || [])); e.target.value = ""; }} />
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => imgRef.current?.click()} disabled={uploading}>
              <ImageIcon className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Paperclip className="w-4 h-4" />
            </Button>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }}
              placeholder={uploading ? "กำลังอัปโหลด…" : "พิมพ์ข้อความ… (Enter ส่ง)"}
              rows={1}
              className="min-h-8 max-h-24 resize-none text-sm py-1.5"
              disabled={uploading}
            />
            <Button size="icon" className="h-8 w-8 flex-shrink-0" onClick={doSend} disabled={!text.trim() || send.isPending}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
    </div>
  );
}

