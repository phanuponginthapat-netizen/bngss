import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, Trash2, Eye, Share2, Loader2, FileText, Send, X } from "lucide-react";
import { toast } from "sonner";
import WorksheetBuilder, { type WSQuestion } from "@/components/worksheets/WorksheetBuilder";
import WorksheetPlayer from "@/components/worksheets/WorksheetPlayer";

type Worksheet = {
  id: string;
  title: string;
  description: string | null;
  grade_level: string | null;
  questions: WSQuestion[];
  share_code: string;
  is_published: boolean;
  created_at: string;
  source_url: string | null;
  source_type: string | null;
  page_count: number | null;
};

export default function WorksheetsPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<Worksheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [playOpen, setPlayOpen] = useState(false);
  const [active, setActive] = useState<Worksheet | null>(null);
  const [saving, setSaving] = useState(false);
  const [metaOpen, setMetaOpen] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("worksheets")
      .select("*")
      .eq("created_by", u.user?.id || "00000000-0000-0000-0000-000000000000")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setList((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const newWorksheet = () => {
    setActive({
      id: "",
      title: "ใบงานใหม่",
      description: "",
      grade_level: "ป.1",
      questions: [],
      share_code: "",
      is_published: true,
      created_at: new Date().toISOString(),
      source_url: null,
      source_type: null,
      page_count: null,
    });
    setEditOpen(true);
  };

  const save = async () => {
    if (!active) return;
    if (!active.title.trim()) { toast.error("กรุณาใส่ชื่อใบงาน"); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload = {
        title: active.title,
        description: active.description,
        grade_level: active.grade_level,
        questions: active.questions as any,
        is_published: active.is_published,
        source_url: active.source_url,
        source_type: active.source_type,
        page_count: active.page_count,
        created_by: u.user?.id,
      };
      if (active.id) {
        const { error } = await supabase.from("worksheets").update(payload).eq("id", active.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("worksheets").insert(payload as any);
        if (error) throw error;
      }
      toast.success("บันทึกแล้ว");
      setEditOpen(false);
      load();
    } catch (e: any) {
      toast.error("บันทึกไม่สำเร็จ: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("ลบใบงานนี้?")) return;
    const { error } = await supabase.from("worksheets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบแล้ว");
    load();
  };

  const shareLink = (code: string) => `${window.location.origin}/w/${code}`;
  const copyLink = (code: string) => {
    navigator.clipboard.writeText(shareLink(code));
    toast.success("คัดลอกลิงก์แล้ว");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-success" />
            ใบงานอินเทอร์แอคทีฟ (ในระบบ)
          </h1>
          <p className="text-muted-foreground text-sm">
            สร้างใบงานออนไลน์เอง — มีเติมคำ, เลือกตอบ, ถูก/ผิด, จับคู่ — ตรวจให้อัตโนมัติ และแชร์ลิงก์ให้นักเรียนทำได้ทันที
          </p>
        </div>
        <Button onClick={newWorksheet}><Plus className="w-4 h-4 mr-1" /> สร้างใบงานใหม่</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin w-6 h-6" /></div>
      ) : list.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          ยังไม่มีใบงาน — กด "สร้างใบงานใหม่" เพื่อเริ่มต้น
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((w) => (
            <Card key={w.id} className="hover:shadow-md transition">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-start justify-between gap-2">
                  <span className="truncate">{w.title}</span>
                  {w.is_published && <Badge variant="secondary" className="shrink-0">เผยแพร่</Badge>}
                </CardTitle>
                <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
                  <span>📚 {w.grade_level || "—"}</span>
                  <span>· {w.questions?.length || 0} ข้อ</span>
                  <span>· รหัส {w.share_code}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {w.description && <p className="text-xs text-muted-foreground line-clamp-2">{w.description}</p>}
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setActive(w); setPlayOpen(true); }}>
                    <Eye className="w-3.5 h-3.5 mr-1" />ทดลอง
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setActive(w); setEditOpen(true); }}>
                    แก้ไข
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copyLink(w.share_code)}>
                    <Share2 className="w-3.5 h-3.5 mr-1" />ลิงก์
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/worksheets/${w.id}/results`)}>
                    คะแนน
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(w.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor dialog — fullscreen, Word-like */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="fixed inset-0 left-0 top-0 z-50 !flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 !overflow-hidden border-0 bg-background p-0 sm:left-0 sm:top-0 sm:h-[100dvh] sm:max-h-[100dvh] sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:p-0 [&>button]:hidden">

          <DialogHeader className="shrink-0 border-b bg-card px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="flex min-w-0 items-center gap-2 text-base">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{active?.id ? "แก้ไขใบงาน" : "สร้างใบงาน"} — {active?.title || "(ยังไม่ตั้งชื่อ)"}</span>
              </DialogTitle>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(false)}>
                  <X className="mr-1 h-4 w-4" /> ปิด
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} บันทึก
                </Button>
              </div>
            </div>
          </DialogHeader>
          {active && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20">
              <div className="min-h-0 flex-1 overflow-hidden">
                <WorksheetBuilder
                  sourceUrl={active.source_url}
                  sourceType={active.source_type}
                  questions={active.questions}
                  onChange={(qs) => setActive({ ...active, questions: qs })}
                  onSourceChange={(info) => setActive({
                    ...active,
                    source_url: info?.url || null,
                    source_type: info?.type || null,
                    page_count: info?.pageCount ?? active.page_count,
                    questions: info ? active.questions : [],
                  })}
                  meta={{ title: active.title, description: active.description, grade_level: active.grade_level }}
                  onMetaChange={(m) => setActive({ ...active, title: m.title, description: m.description, grade_level: m.grade_level })}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview/Play dialog */}
      <Dialog open={playOpen} onOpenChange={setPlayOpen}>
        <DialogContent className="fixed inset-0 left-0 top-0 z-50 !flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 !overflow-hidden border-0 bg-background p-0 sm:left-0 sm:top-0 sm:h-[100dvh] sm:max-h-[100dvh] sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:p-0 [&>button]:hidden">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle>ตัวอย่างใบงาน (โหมดนักเรียน)</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
            {active && <WorksheetPlayer worksheet={active} preview />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
