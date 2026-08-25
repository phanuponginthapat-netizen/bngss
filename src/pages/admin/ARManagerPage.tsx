import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import {
  Boxes, Plus, Pencil, Trash2, QrCode, Upload, ExternalLink, Download, Eye,
  FolderOpen, ArrowLeft, Printer, MapPin, Target, Loader2, Camera,
} from "lucide-react";
import { swal } from "@/lib/swal";
import ArMediaViewer from "@/components/ar/ArMediaViewer";
import { uploadArFile, resolveArUrl, toStorageRef, AR_BUCKET } from "@/lib/arMedia";
import { compileTargets } from "@/lib/mindAr";
import ArImage from "@/components/ar/ArImage";

interface ArProject {
  id: string; slug: string; title: string; description: string | null;
  cover_url: string | null; location: string | null;
  is_public: boolean; is_active: boolean;
  targets_url: string | null; targets_version: number | null;
}

interface ArItem {
  id: string; code: string; title: string; marker_label: string | null;
  sort_order: number; description: string | null; project_id: string | null;
  media_type: string; media_url: string; poster_url: string | null;
  subject: string | null; grade_level: string | null; tags: string[] | null;
  is_public: boolean; is_active: boolean; view_count: number;
  marker_image_url: string | null; target_index: number | null;
  overlay_width: number | null; overlay_height: number | null;
  loop_media: boolean | null; muted: boolean | null;
}

const MEDIA_TYPES = [
  { value: "image", label: "ภาพนิ่ง" },
  { value: "video", label: "วิดีโอ (ไฟล์)" },
  { value: "youtube", label: "วิดีโอ YouTube" },
  { value: "model3d", label: "โมเดล 3 มิติ / AR (.glb)" },
];

const emptyItem = {
  id: "", code: "", title: "", marker_label: "", sort_order: 0, description: "",
  media_type: "image", media_url: "", poster_url: "", subject: "", grade_level: "",
  tags: "", is_public: true, is_active: true,
  marker_image_url: "", overlay_width: 1, overlay_height: 0.5625,
  loop_media: true, muted: true,
};

const emptyProject = {
  id: "", slug: "", title: "", description: "", cover_url: "", location: "",
  is_public: true, is_active: true,
};

const rand = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const genCode = () => "ar" + rand();
const genSlug = (title: string) => {
  const base = (title || "").trim().toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, "-").replace(/^-+|-+$/g, "");
  return (base ? base.slice(0, 32) + "-" : "งาน-") + rand().slice(0, 4);
};

export default function ARManagerPage() {
  const [projects, setProjects] = useState<ArProject[]>([]);
  const [items, setItems] = useState<ArItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [projOpen, setProjOpen] = useState(false);
  const [projForm, setProjForm] = useState({ ...emptyProject });
  const [itemOpen, setItemOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyItem });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<{ title: string; url: string; file: string } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const itemUrl = (code: string) => `${baseUrl}/ar/${code}`;
  const projectUrl = (slug: string) => `${baseUrl}/ar/p/${slug}`;

  const active = useMemo(() => projects.find((p) => p.id === activeId) || null, [projects, activeId]);
  const activeItems = useMemo(
    () => items.filter((i) => (activeId ? i.project_id === activeId : !i.project_id))
      .sort((a, b) => a.sort_order - b.sort_order),
    [items, activeId]
  );

  const load = async () => {
    setLoading(true);
    const [p, i] = await Promise.all([
      supabase.from("ar_projects" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("ar_experiences" as any).select("*").order("sort_order", { ascending: true }),
    ]);
    if (p.error) toast.error("โหลดงานไม่สำเร็จ: " + p.error.message);
    if (i.error) toast.error("โหลดสื่อไม่สำเร็จ: " + i.error.message);
    setProjects((p.data as any) || []);
    setItems((i.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /* ---------- projects ---------- */
  const openNewProject = () => { setProjForm({ ...emptyProject }); setProjOpen(true); };
  const openEditProject = (p: ArProject) => {
    setProjForm({
      id: p.id, slug: p.slug, title: p.title, description: p.description || "",
      cover_url: p.cover_url || "", location: p.location || "",
      is_public: p.is_public, is_active: p.is_active,
    });
    setProjOpen(true);
  };

  const saveProject = async () => {
    if (!projForm.title.trim()) { toast.error("กรุณากรอกชื่องาน"); return; }
    setSaving(true);
    const payload: any = {
      slug: (projForm.slug || genSlug(projForm.title)).trim(),
      title: projForm.title.trim(),
      description: projForm.description.trim() || null,
      cover_url: projForm.cover_url.trim() || null,
      location: projForm.location.trim() || null,
      is_public: projForm.is_public,
      is_active: projForm.is_active,
    };
    const q = projForm.id
      ? supabase.from("ar_projects" as any).update(payload).eq("id", projForm.id)
      : supabase.from("ar_projects" as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error("บันทึกไม่สำเร็จ: " + error.message); return; }
    toast.success("บันทึกงานสำเร็จ");
    setProjOpen(false);
    load();
  };

  const removeProject = async (p: ArProject) => {
    const ok = await swal.confirm({ title: `ลบงาน “${p.title}”?`, text: "ป้ายในงานนี้จะไม่ถูกลบ แต่จะไม่สังกัดงานใด", danger: true, icon: "warning" });
    if (!ok) return;
    const { error } = await supabase.from("ar_projects" as any).delete().eq("id", p.id);
    if (error) { toast.error("ลบไม่สำเร็จ: " + error.message); return; }
    toast.success("ลบงานแล้ว");
    if (activeId === p.id) setActiveId(null);
    load();
  };

  /* ---------- items ---------- */
  const openNewItem = () => {
    setForm({ ...emptyItem, code: genCode(), sort_order: activeItems.length + 1 });
    setItemOpen(true);
  };
  const openEditItem = (i: ArItem) => {
    setForm({
      id: i.id, code: i.code, title: i.title, marker_label: i.marker_label || "",
      sort_order: i.sort_order, description: i.description || "", media_type: i.media_type,
      media_url: i.media_url, poster_url: i.poster_url || "", subject: i.subject || "",
      grade_level: i.grade_level || "", tags: (i.tags || []).join(", "),
      is_public: i.is_public, is_active: i.is_active,
      marker_image_url: i.marker_image_url || "",
      overlay_width: Number(i.overlay_width ?? 1),
      overlay_height: Number(i.overlay_height ?? 0.5625),
      loop_media: i.loop_media !== false, muted: i.muted !== false,
    });
    setItemOpen(true);
  };

  const upload = async (file: File, kind: string, setter: (ref: string) => void) => {
    setUploading(kind);
    try {
      const ref = await uploadArFile(file, active?.slug || form.code || "general", kind);
      setter(ref);
      toast.success("อัปโหลดสำเร็จ");
    } catch (e: any) {
      toast.error("อัปโหลดไม่สำเร็จ: " + (e?.message || ""));
    } finally {
      setUploading(null);
    }
  };

  const saveItem = async () => {
    if (!form.title.trim()) { toast.error("กรุณากรอกชื่อสื่อ/ป้าย"); return; }
    if (!form.media_url.trim()) { toast.error("กรุณาอัปโหลดไฟล์หรือใส่ลิงก์สื่อ"); return; }
    setSaving(true);
    const payload: any = {
      code: (form.code || genCode()).trim(),
      project_id: activeId,
      title: form.title.trim(),
      marker_label: form.marker_label.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      description: form.description.trim() || null,
      media_type: form.media_type,
      media_url: form.media_url.trim(),
      poster_url: form.poster_url.trim() || null,
      subject: form.subject.trim() || null,
      grade_level: form.grade_level.trim() || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      is_public: form.is_public,
      is_active: form.is_active,
      marker_image_url: form.marker_image_url.trim() || null,
      overlay_width: Number(form.overlay_width) || 1,
      overlay_height: Number(form.overlay_height) || 0.5625,
      loop_media: form.loop_media,
      muted: form.muted,
    };
    const q = form.id
      ? supabase.from("ar_experiences" as any).update(payload).eq("id", form.id)
      : supabase.from("ar_experiences" as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error("บันทึกไม่สำเร็จ: " + error.message); return; }
    toast.success("บันทึกสำเร็จ");
    setItemOpen(false);
    load();
  };

  const removeItem = async (i: ArItem) => {
    const ok = await swal.confirm({ title: `ลบป้าย “${i.title}”?`, text: "การลบไม่สามารถย้อนกลับได้", danger: true, icon: "warning" });
    if (!ok) return;
    const { error } = await supabase.from("ar_experiences" as any).delete().eq("id", i.id);
    if (error) { toast.error("ลบไม่สำเร็จ: " + error.message); return; }
    toast.success("ลบแล้ว");
    load();
  };

  /* ---------- QR ---------- */
  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !qrTarget) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-${qrTarget.file}.png`;
    a.click();
  };

  const printSheet = () => {
    const html = sheetRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) { toast.error("เบราว์เซอร์บล็อกหน้าต่างพิมพ์"); return; }
    w.document.write(`<html><head><title>QR ${active?.title || "AR"}</title>
      <style>body{font-family:sans-serif;padding:16px}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
      .cell{border:1px solid #ddd;border-radius:8px;padding:10px;text-align:center;page-break-inside:avoid}
      .t{font-weight:600;font-size:13px;margin-top:6px}.s{font-size:11px;color:#666;word-break:break-all}
      </style></head><body><h2>${active?.title || "สื่อ AR"}</h2><div class="grid">${html}</div></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const stats = useMemo(() => ({
    projects: projects.length,
    items: items.length,
    views: items.reduce((s, i) => s + (i.view_count || 0), 0),
  }), [projects, items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Boxes className="h-6 w-6 text-primary" />งาน AR / QR แหล่งเรียนรู้</h1>
          <p className="text-sm text-muted-foreground">บุคลากรล็อกอินเพื่อจัดการ — ผู้ชมทั่วไปสแกน QR ที่ป้ายแล้วดูสื่อได้ทันทีโดยไม่ต้องล็อกอิน</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><a href="/ar" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" />ดูหน้าสาธารณะ</a></Button>
          {!active && <Button onClick={openNewProject}><Plus className="h-4 w-4 mr-2" />สร้างงาน AR</Button>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">งานทั้งหมด</p><p className="text-2xl font-bold">{stats.projects}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">ป้าย/สื่อทั้งหมด</p><p className="text-2xl font-bold">{stats.items}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">ยอดเข้าชมรวม</p><p className="text-2xl font-bold">{stats.views}</p></CardContent></Card>
      </div>

      {loading ? (
        <p className="text-muted-foreground py-10 text-center">กำลังโหลด...</p>
      ) : !active ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FolderOpen className="h-5 w-5" />งาน AR</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {projects.length === 0 && (
              <p className="text-muted-foreground py-6 text-center">ยังไม่มีงาน — กด “สร้างงาน AR” เช่น “AR ผ้าฝ้าย” แล้วจึงเพิ่มป้ายในงาน</p>
            )}
            {projects.map((p) => {
              const count = items.filter((i) => i.project_id === p.id).length;
              return (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border flex-wrap">
                  <button className="flex-1 min-w-[200px] text-left" onClick={() => setActiveId(p.id)}>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">/ar/p/{p.slug}{p.location ? ` · ${p.location}` : ""}</div>
                  </button>
                  <Badge variant="outline">{count} ป้าย</Badge>
                  <Badge variant={p.is_public && p.is_active ? "default" : "secondary"}>{p.is_public && p.is_active ? "เผยแพร่" : "ปิด"}</Badge>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setQrTarget({ title: p.title, url: projectUrl(p.slug), file: `project-${p.slug}` })}><QrCode className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => openEditProject(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeProject(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}
            {items.some((i) => !i.project_id) && (
              <Button variant="outline" className="w-full" onClick={() => setActiveId(null)}>
                สื่อที่ยังไม่สังกัดงาน ({items.filter((i) => !i.project_id).length})
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setActiveId(null)}><ArrowLeft className="h-4 w-4 mr-1" />ทุกงาน</Button>
                {active.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                {active.location && <><MapPin className="h-3 w-3" />{active.location} · </>}/ar/p/{active.slug}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}><Printer className="h-4 w-4 mr-2" />พิมพ์ QR ทั้งงาน</Button>
              <Button size="sm" onClick={openNewItem}><Plus className="h-4 w-4 mr-2" />เพิ่มป้าย AR</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeItems.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center">ยังไม่มีป้ายในงานนี้ — กด “เพิ่มป้าย AR” เพื่อใส่วีดีโอ/ภาพ/โมเดล 3 มิติ แล้วออก QR</p>
            ) : activeItems.map((i, idx) => (
              <div key={i.id} className="flex items-center gap-3 p-3 rounded-lg border flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-medium">{idx + 1}. {i.title}</div>
                  <div className="text-xs text-muted-foreground">{i.marker_label ? `ป้าย: ${i.marker_label} · ` : ""}/ar/{i.code}</div>
                </div>
                <Badge variant="outline">{MEDIA_TYPES.find((m) => m.value === i.media_type)?.label || i.media_type}</Badge>
                <Badge variant={i.is_public && i.is_active ? "default" : "secondary"}>{i.is_public && i.is_active ? "เผยแพร่" : "ปิด"}</Badge>
                <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />{i.view_count}</Badge>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setQrTarget({ title: i.title, url: itemUrl(i.code), file: `ar-${i.code}` })}><QrCode className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEditItem(i)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Project editor */}
      <Dialog open={projOpen} onOpenChange={setProjOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{projForm.id ? "แก้ไขงาน AR" : "สร้างงาน AR"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ชื่องาน *</Label><Input value={projForm.title} onChange={(e) => setProjForm({ ...projForm, title: e.target.value })} placeholder="เช่น AR ผ้าฝ้าย" /></div>
            <div><Label>รหัสงาน (URL)</Label><Input value={projForm.slug} onChange={(e) => setProjForm({ ...projForm, slug: e.target.value })} placeholder="เว้นว่างเพื่อสร้างอัตโนมัติ" /></div>
            <div><Label>สถานที่จัดแสดง</Label><Input value={projForm.location} onChange={(e) => setProjForm({ ...projForm, location: e.target.value })} /></div>
            <div><Label>คำอธิบาย</Label><Textarea rows={3} value={projForm.description} onChange={(e) => setProjForm({ ...projForm, description: e.target.value })} /></div>
            <div>
              <Label>ภาพปกงาน</Label>
              <div className="flex gap-2">
                <Input value={projForm.cover_url} onChange={(e) => setProjForm({ ...projForm, cover_url: e.target.value })} />
                <Button type="button" variant="outline" disabled={uploading === "cover"} asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />{uploading === "cover" ? "กำลังอัปโหลด" : "อัปโหลด"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "cover", (ref) => setProjForm((p) => ({ ...p, cover_url: ref }))); e.currentTarget.value = ""; }} />
                  </label>
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={projForm.is_public} onCheckedChange={(v) => setProjForm({ ...projForm, is_public: v })} />เผยแพร่สาธารณะ</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={projForm.is_active} onCheckedChange={(v) => setProjForm({ ...projForm, is_active: v })} />เปิดใช้งาน</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjOpen(false)}>ยกเลิก</Button>
            <Button onClick={saveProject} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item editor */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "แก้ไขป้าย AR" : "เพิ่มป้าย AR"}{active ? ` · ${active.title}` : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>ชื่อสื่อ/หัวข้อ *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>ชื่อป้าย (จุดติดตั้ง)</Label><Input value={form.marker_label} onChange={(e) => setForm({ ...form, marker_label: e.target.value })} placeholder="เช่น ป้ายที่ 1 กี่ทอผ้า" /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>รหัส QR</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>ลำดับ</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
            </div>
            <div><Label>คำอธิบาย</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>ประเภทสื่อ</Label>
                <Select value={form.media_type} onValueChange={(v) => setForm({ ...form, media_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MEDIA_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>กลุ่มสาระ/วิชา</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
              <div><Label>ระดับชั้น</Label><Input value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} /></div>
            </div>
            <div>
              <Label>ไฟล์/ลิงก์สื่อ *</Label>
              <div className="flex gap-2">
                <Input value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="อัปโหลดไฟล์ หรือวางลิงก์ (.glb / .mp4 / YouTube)" />
                {form.media_type !== "youtube" && (
                  <Button type="button" variant="outline" disabled={uploading === "media"} asChild>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />{uploading === "media" ? "กำลังอัปโหลด" : "อัปโหลด"}
                      <input type="file" className="hidden"
                        accept={form.media_type === "model3d" ? ".glb,.gltf,model/gltf-binary" : form.media_type === "video" ? "video/*" : "image/*"}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "media", (ref) => setForm((s) => ({ ...s, media_url: ref }))); e.currentTarget.value = ""; }} />
                    </label>
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label>ภาพปก (ไม่บังคับ)</Label>
              <div className="flex gap-2">
                <Input value={form.poster_url} onChange={(e) => setForm({ ...form, poster_url: e.target.value })} />
                <Button type="button" variant="outline" disabled={uploading === "poster"} asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />{uploading === "poster" ? "กำลังอัปโหลด" : "อัปโหลด"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "poster", (ref) => setForm((s) => ({ ...s, poster_url: ref }))); e.currentTarget.value = ""; }} />
                  </label>
                </Button>
              </div>
            </div>
            <div><Label>แท็ก (คั่นด้วย ,)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} /></div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_public} onCheckedChange={(v) => setForm({ ...form, is_public: v })} />เผยแพร่สาธารณะ</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />เปิดใช้งาน</label>
            </div>
            {form.media_url && (
              <div className="pt-2">
                <Label className="mb-2 block">ตัวอย่าง</Label>
                <ArMediaViewer mediaType={form.media_type} mediaUrl={form.media_url} posterUrl={form.poster_url} title={form.title} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>ยกเลิก</Button>
            <Button onClick={saveItem} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR single */}
      <Dialog open={!!qrTarget} onOpenChange={(o) => !o && setQrTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Code</DialogTitle></DialogHeader>
          {qrTarget && (
            <div className="space-y-3 text-center">
              <div ref={qrRef} className="flex justify-center bg-white p-4 rounded-lg">
                <QRCodeCanvas value={qrTarget.url} size={220} includeMargin level="M" />
              </div>
              <div className="font-medium">{qrTarget.title}</div>
              <div className="text-xs text-muted-foreground break-all">{qrTarget.url}</div>
              <Button className="w-full" onClick={downloadQr}><Download className="h-4 w-4 mr-2" />ดาวน์โหลด QR</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* QR sheet */}
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>QR ทั้งงาน · {active?.title}</DialogTitle></DialogHeader>
          <div ref={sheetRef} className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white p-3 rounded-lg">
            {active && (
              <div className="cell border rounded-lg p-3 text-center">
                <QRCodeCanvas value={projectUrl(active.slug)} size={150} includeMargin level="M" />
                <div className="t font-semibold text-sm mt-1 text-black">รวมทั้งงาน</div>
                <div className="s text-[11px] text-gray-600 break-all">{projectUrl(active.slug)}</div>
              </div>
            )}
            {activeItems.map((i, idx) => (
              <div key={i.id} className="cell border rounded-lg p-3 text-center">
                <QRCodeCanvas value={itemUrl(i.code)} size={150} includeMargin level="M" />
                <div className="t font-semibold text-sm mt-1 text-black">{idx + 1}. {i.marker_label || i.title}</div>
                <div className="s text-[11px] text-gray-600 break-all">{itemUrl(i.code)}</div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSheetOpen(false)}>ปิด</Button>
            <Button onClick={printSheet}><Printer className="h-4 w-4 mr-2" />พิมพ์</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
