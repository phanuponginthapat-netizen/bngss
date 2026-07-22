import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Heart, MessageCircle, Trash2, Pin, Globe, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";

const fmtDate = (d: string) =>
  new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

const visIcon = (v: string) =>
  v === "public" ? <Globe className="w-3 h-3" /> :
  v === "school" ? <Users className="w-3 h-3" /> :
  <Lock className="w-3 h-3" />;

export default function MyPostsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["my_wall_posts", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("wall_posts")
        .select("*")
        .eq("author_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const del = async (id: string) => {
    const ok = await swal.confirm({
      title: "ยืนยันการลบโพสต์?",
      text: "โพสต์นี้จะถูกลบถาวร ไม่สามารถกู้คืนได้",
      confirmText: "ลบโพสต์",
      cancelText: "ยกเลิก",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(id);
    const { error } = await supabase.from("wall_posts").delete().eq("id", id);
    setDeletingId(null);
    if (error) return swal.error("ลบไม่สำเร็จ", error.message);
    swal.success("ลบโพสต์แล้ว");
    qc.invalidateQueries({ queryKey: ["my_wall_posts", userId] });
  };

  if (isLoading) return <Card><CardContent className="py-12 text-center text-muted-foreground">กำลังโหลด...</CardContent></Card>;

  if (posts.length === 0) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground space-y-2">
        <MessageSquare className="w-10 h-10 mx-auto opacity-40" />
        <div>ยังไม่มีโพสต์</div>
        <div className="text-xs">โพสต์ของคุณบนฟีดโรงเรียนจะแสดงที่นี่</div>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <p className="text-sm text-muted-foreground">โพสต์ทั้งหมด {posts.length} โพสต์</p>
      </div>
      {posts.map((p: any) => {
        const photos: string[] = Array.isArray(p.media_urls) ? p.media_urls : [];
        return (
          <Card key={p.id} className="border-0 shadow-md">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>{fmtDate(p.created_at)}</span>
                  <Badge variant="outline" className="gap-1 text-xs">{visIcon(p.visibility)} {p.visibility}</Badge>
                  {p.is_pinned && <Badge variant="secondary" className="gap-1"><Pin className="w-3 h-3" /> ปักหมุด</Badge>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => del(p.id)} disabled={deletingId === p.id}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
              {p.content && <p className="text-sm whitespace-pre-wrap">{p.content}</p>}
              {photos.length > 0 && (
                <div className={`grid gap-2 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3"}`}>
                  {photos.slice(0, 6).map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer">
                      <img src={u} alt="" className="w-full h-32 object-cover rounded-lg border" />
                    </a>
                  ))}
                </div>
              )}
              {p.link_url && (
                <a href={p.link_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline truncate block">
                  {p.link_url}
                </a>
              )}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
                <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {p.reaction_count || 0}</span>
                <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {p.comment_count || 0}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
