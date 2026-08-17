import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, Key, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { ALL_GRADE_LEVELS, gradeRank } from "@/lib/gradeOrder";
import { useAuthSession } from "@/hooks/useAuthSession";
import { saveErrorMessage } from "@/lib/saveError";

type Game = {
  id?: string;
  title: string;
  description: string;
  cover_url: string | null;
  type: "external_link" | "embed";
  url: string;
  embed_code: string;
  min_grade: number | null;
  max_grade: number | null;
  tags: string[];
  is_active: boolean;
};

const EMPTY: Game = {
  title: "", description: "", cover_url: null, type: "external_link",
  url: "", embed_code: "", min_grade: null, max_grade: null, tags: [], is_active: true,
};

export default function GameHubAdminPage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Game>(EMPTY);
  const [uploading, setUploading] = useState(false);

  const { data: games = [] } = useQuery({
    queryKey: ["game-hub-admin-list"],
    queryFn: async () => {
      const { data } = await supabase.from("game_hub_games").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (g: Game) => {
      if (!user?.id) throw new Error("ต้องเข้าสู่ระบบ");
      const payload: any = {
        title: g.title.trim(),
        description: g.description || null,
        cover_url: g.cover_url,
        type: g.type,
        url: g.type === "external_link" ? g.url.trim() || null : null,
        embed_code: g.type === "embed" ? g.embed_code || null : null,
        min_grade: g.min_grade,
        max_grade: g.max_grade,
        tags: g.tags,
        is_active: g.is_active,
      };
      if (g.id) {
        const { error } = await supabase.from("game_hub_games").update(payload).eq("id", g.id);
        if (error) throw error;
      } else {
        payload.created_by = user.id;
        const { error } = await supabase.from("game_hub_games").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("บันทึกเกมแล้ว");
      setOpen(false);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["game-hub-admin-list"] });
    },
    onError: (e: any) => toast.error(e.message || "บันทึกไม่สำเร็จ"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("game_hub_games").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบแล้ว");
      qc.invalidateQueries({ queryKey: ["game-hub-admin-list"] });
    },
    onError: (e: any) => toast.error(saveErrorMessage(e)),
  });

  const uploadCover = async (file: File) => {
    if (!user?.id) return;
    setUploading(true);
    try {
      const ext = (file.name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] || "png").toLowerCase();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("game-covers").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = await supabase.storage.from("game-covers").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      setForm((f) => ({ ...f, cover_url: data?.signedUrl || null }));
      toast.success("อัปโหลดภาพปกแล้ว");
    } catch (e: any) {
      toast.error(e.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild><Link to="/dashboard/games"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link></Button>
          <h1 className="text-2xl font-bold">จัดการเกม (Game Hub)</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/dashboard/games/api-keys"><Key className="w-4 h-4 mr-1" />API Keys</Link></Button>
          <Button onClick={() => { setForm(EMPTY); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />แขวนเกมใหม่</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">รายการเกมทั้งหมด ({games.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {games.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีเกมในระบบ</div>}
          {games.map((g: any) => (
            <div key={g.id} className="flex items-center gap-3 border rounded-lg p-3">
              <div className="w-16 h-12 bg-muted rounded overflow-hidden shrink-0">
                {g.cover_url && <img loading="lazy" decoding="async" src={g.cover_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{g.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {g.type === "external_link" ? g.url : "โค้ดฝัง"} · {g.min_grade != null ? ALL_GRADE_LEVELS[g.min_grade] : "-"}–{g.max_grade != null ? ALL_GRADE_LEVELS[g.max_grade] : "-"}
                </div>
              </div>
              {!g.is_active && <Badge variant="outline">ปิด</Badge>}
              <Button variant="ghost" size="icon" onClick={() => { setForm({ ...g, tags: g.tags || [] }); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => { if (confirm("ลบเกมนี้?")) del.mutate(g.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "แก้ไขเกม" : "แขวนเกมใหม่"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ชื่อเกม *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>คำอธิบาย</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>ภาพปก</Label>
              <div className="flex items-center gap-2 mt-1">
                {form.cover_url && <img loading="lazy" decoding="async" src={form.cover_url} alt="" className="w-24 h-16 object-cover rounded border" />}
                <label className="inline-flex">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
                  <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
                    <span><Upload className="w-4 h-4 mr-1" />{uploading ? "กำลังอัปโหลด..." : "อัปโหลด"}</span>
                  </Button>
                </label>
              </div>
            </div>
            <div>
              <Label>ประเภทเกม</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="external_link">ลิงก์ภายนอก (external URL)</SelectItem>
                  <SelectItem value="embed">โค้ด HTML / iframe (ฝังในระบบ)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === "external_link" && (
              <div>
                <Label>URL เกมภายนอก</Label>
                <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
              </div>
            )}
            {form.type === "embed" && (
              <div>
                <Label>โค้ด HTML/iframe</Label>
                <Textarea value={form.embed_code} onChange={(e) => setForm({ ...form, embed_code: e.target.value })} rows={6} placeholder="<iframe src='...' />" />
                <p className="text-[11px] text-muted-foreground mt-1">รันในกรอบ sandbox ปิดสิทธิ์ต้นทาง</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>ช่วงชั้นต่ำสุด</Label>
                <Select value={form.min_grade == null ? "" : String(form.min_grade)} onValueChange={(v) => setForm({ ...form, min_grade: v ? Number(v) : null })}>
                  <SelectTrigger><SelectValue placeholder="ไม่จำกัด" /></SelectTrigger>
                  <SelectContent>
                    {ALL_GRADE_LEVELS.map((g) => <SelectItem key={g} value={String(gradeRank(g))}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ช่วงชั้นสูงสุด</Label>
                <Select value={form.max_grade == null ? "" : String(form.max_grade)} onValueChange={(v) => setForm({ ...form, max_grade: v ? Number(v) : null })}>
                  <SelectTrigger><SelectValue placeholder="ไม่จำกัด" /></SelectTrigger>
                  <SelectContent>
                    {ALL_GRADE_LEVELS.map((g) => <SelectItem key={g} value={String(gradeRank(g))}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>แท็ก (คั่นด้วยจุลภาค)</Label>
              <Input
                value={form.tags.join(", ")}
                onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                placeholder="คณิต, เกมคำนวณ, e-learning"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>เปิดใช้งาน</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button disabled={!form.title || save.isPending} onClick={() => save.mutate(form)}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
