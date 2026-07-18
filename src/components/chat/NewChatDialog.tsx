import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Check, Search, Users } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useCreateConversation } from "@/hooks/useChat";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (conversationId: string) => void;
}

export function NewChatDialog({ open, onOpenChange, onCreated }: Props) {
  const { userId } = useUserRole();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, { id: string; name: string; avatar_url: string | null }>>({});
  const [groupName, setGroupName] = useState("");
  const create = useCreateConversation();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["chat_user_search", search],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_chat_users", { _term: search.trim() });
      if (error) { console.error(error); return []; }
      return data || [];
    },
  });

  const selectedIds = Object.keys(selected);
  const isGroup = selectedIds.length > 1;

  const toggle = (u: any) => {
    setSelected((s) => {
      const next = { ...s };
      if (next[u.id]) delete next[u.id];
      else next[u.id] = { id: u.id, name: `${u.first_name || ""} ${u.last_name || ""}`.trim(), avatar_url: u.avatar_url };
      return next;
    });
  };

  const handleCreate = async () => {
    if (!selectedIds.length) return;
    try {
      const convId = await create.mutateAsync({
        userIds: selectedIds,
        name: isGroup ? groupName || undefined : undefined,
        isGroup,
      });
      onCreated(convId);
      onOpenChange(false);
      setSelected({});
      setGroupName("");
      setSearch("");
    } catch (e: any) {
      toast.error(e.message || "สร้างแชทไม่สำเร็จ");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> เริ่มแชทใหม่
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ, ชื่อเล่น, รหัสนักเรียน/พนักงาน…"
              className="pl-9"
              autoFocus
            />
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.values(selected).map((s) => (
                <Badge key={s.id} variant="secondary" className="pl-1 pr-2 py-1 gap-1.5 cursor-pointer" onClick={() => toggle(s)}>
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={s.avatar_url || undefined} />
                    <AvatarFallback className="text-[9px]">{s.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  {s.name || "ผู้ใช้"} ✕
                </Badge>
              ))}
            </div>
          )}

          {isGroup && (
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="ตั้งชื่อกลุ่ม (ไม่บังคับ)" />
          )}

          <ScrollArea className="h-72 -mx-2">
            <div className="px-2 space-y-1">
              {isLoading ? (
                <div className="text-sm text-muted-foreground text-center py-8">กำลังโหลด…</div>
              ) : users.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">ไม่พบผู้ใช้</div>
              ) : (
                users.map((u: any) => {
                  const isSel = !!selected[u.id];
                  const name = `${u.first_name || ""} ${u.last_name || ""}`.trim() || "ผู้ใช้";
                  const code = u.student_code || u.employee_code;
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggle(u)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                        isSel ? "bg-primary/10" : "hover:bg-muted"
                      }`}
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback>{name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{name}{u.nickname ? ` (${u.nickname})` : ""}</div>
                        {code && <div className="text-xs text-muted-foreground truncate">{code}</div>}
                      </div>
                      {isSel && <Check className="w-4 h-4 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleCreate} disabled={!selectedIds.length || create.isPending}>
            {create.isPending ? "กำลังสร้าง…" : isGroup ? `สร้างกลุ่ม (${selectedIds.length})` : "เริ่มแชท"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
