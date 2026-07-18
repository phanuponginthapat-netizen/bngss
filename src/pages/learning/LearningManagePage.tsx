import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { GraduationCap, Plus, Pencil, Trash2, Eye, EyeOff, Copy, BarChart3, Play, Search } from "lucide-react";
import LearningContentDialog from "@/components/learning/LearningContentDialog";
import LearningPlayer from "@/components/learning/LearningPlayer";
import { toast } from "sonner";
import { getKindLabel, getVisibilityLabel, generatePublicShareLink } from "@/lib/learningProxy";
import { deleteContentFiles } from "@/lib/learningUpload";
import { useUserRole } from "@/hooks/useUserRole";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

export default function LearningManagePage() {
  const { isAdmin, isDirector, userId } = useUserRole();
  const canManageAll = isAdmin || isDirector;
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [playing, setPlaying] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: contents = [] } = useQuery({
    queryKey: ["learning_contents_manage"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      let q = supabase
        .from("learning_contents")
        .select("*")
        .order("created_at", { ascending: false });
      // ครูเห็นแค่ของตัว, ผู้บริหารเห็นทั้ง รร
      if (!(isAdmin || isDirector)) q = q.eq("owner_id", user.id);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: viewStats = {} } = useQuery({
    queryKey: ["learning_view_stats", contents.map(c => c.id).join(",")],
    enabled: contents.length > 0,
    queryFn: async () => {
      const ids = contents.map(c => c.id);
      const { data } = await supabase
        .from("learning_views")
        .select("content_id, user_id, duration_seconds")
        .in("content_id", ids);
      const stats: Record<string, { views: number; users: number; minutes: number }> = {};
      for (const id of ids) stats[id] = { views: 0, users: 0, minutes: 0 };
      const userSets: Record<string, Set<string>> = {};
      for (const id of ids) userSets[id] = new Set();
      for (const r of data || []) {
        stats[r.content_id].views++;
        stats[r.content_id].minutes += Math.floor((r.duration_seconds || 0) / 60);
        if (r.user_id) userSets[r.content_id].add(r.user_id);
      }
      for (const id of ids) stats[id].users = userSets[id].size;
      return stats;
    },
  });

  const filtered = contents.filter(c =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggleActive = async (c: any) => {
    await supabase.from("learning_contents").update({ is_active: !c.is_active }).eq("id", c.id);
    qc.invalidateQueries({ queryKey: ["learning_contents_manage"] });
    toast.success(c.is_active ? "ปิดการใช้งานแล้ว" : "เปิดใช้งานแล้ว");
  };

  const handleDelete = async (c: any) => {
    try {
      if (["html_single","html_zip","pdf"].includes(c.kind)) {
        await deleteContentFiles(c.id);
      }
      await supabase.from("learning_contents").delete().eq("id", c.id);
      qc.invalidateQueries({ queryKey: ["learning_contents_manage"] });
      toast.success("ลบแล้ว");
    } catch (e: any) {
      toast.error(e?.message || "ลบไม่สำเร็จ");
    }
  };

  const copyPublicLink = (slug: string) => {
    const url = generatePublicShareLink(slug);
    navigator.clipboard.writeText(url);
    toast.success("คัดลอกลิงก์แล้ว");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-lg">
          <GraduationCap className="w-6 h-6 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">E-Learning สื่อการเรียน</h1>
          <p className="text-sm text-muted-foreground">แขวนเกม / สื่อ HTML / วิดีโอ / PDF ให้นักเรียนเข้าใช้</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> เพิ่มสื่อ
        </Button>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="ค้นหาชื่อสื่อ..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          ยังไม่มีสื่อการเรียนรู้ — กด "เพิ่มสื่อ" เพื่อเริ่มต้น
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c: any) => {
            const stats = viewStats[c.id] || { views: 0, users: 0, minutes: 0 };
            return (
              <Card key={c.id} className={!c.is_active ? "opacity-60" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{c.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{c.description || "—"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{getKindLabel(c.kind)}</Badge>
                    {c.grade_level && c.grade_level !== "all" && <Badge variant="outline">{c.grade_level}</Badge>}
                    {c.subject_group && <Badge variant="outline">{c.subject_group}</Badge>}
                    <Badge variant={c.visibility === "public" ? "default" : "outline"}>{getVisibilityLabel(c.visibility)}</Badge>
                  </div>

                  {c.tracking_enabled && (
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      <span><BarChart3 className="w-3 h-3 inline mr-1" /> เปิด {stats.views} ครั้ง</span>
                      <span>👥 {stats.users} คน</span>
                      <span>⏱ {stats.minutes} นาที</span>
                    </div>
                  )}

                  {c.visibility === "public" && c.public_slug && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => copyPublicLink(c.public_slug)}>
                      <Copy className="w-3 h-3 mr-1" /> คัดลอกลิงก์สาธารณะ
                    </Button>
                  )}

                  <div className="flex gap-1">
                    <Button size="sm" variant="default" className="flex-1" onClick={() => setPlaying(c)}>
                      <Play className="w-3 h-3 mr-1" /> เล่น
                    </Button>
                    {(canManageAll || c.owner_id === userId) && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleActive(c)} title={c.is_active ? "ปิด" : "เปิด"}>
                          {c.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>ลบ "{c.title}"?</AlertDialogTitle>
                              <AlertDialogDescription>การลบจะลบไฟล์และสถิติทั้งหมด — กู้คืนไม่ได้</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(c)} className="bg-destructive">ลบ</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <LearningContentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["learning_contents_manage"] })}
      />

      {playing && <LearningPlayer content={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
