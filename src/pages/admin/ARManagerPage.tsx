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
import { Boxes, Plus, Pencil, Trash2, QrCode, Upload, ExternalLink, Download, Eye } from "lucide-react";
import { confirmDelete } from "@/lib/swal";
import ArMediaViewer from "@/components/ar/ArMediaViewer";

interface ArItem {
  id: string; code: string; title: string; description: string | null;
  media_type: string; media_url: string; poster_url: string | null;
  subject: string | null; grade_level: string | null; tags: string[] | null;
  is_public: boolean; is_active: boolean; view_count: number;
}

const MEDIA_TYPES = [
  { value: "image", label: "ภาพนิ่ง" },
  { value: "video", label: "วิดีโอ (ไฟล์)" },
  { value: "youtube", label: "วิดีโอ YouTube" },
  { value: "model3d", label: "โมเดล 3 มิติ / AR (.glb)" },
];

const emptyForm = {
  id: "", code: "", title: "", description: "", media_type: "image",
  media_url: "", poster_url: "", subject: "", grade_level: "", tags: "",
  is_public: true, is_active: true,
};

const genCode = () =>
  "ar" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

export default function ARManagerPage() {
  const [items, setItems] = useState<ArItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [uploading, setUploading] = useState<"media" | "poster" | null>(null);
  const [qrItem, setQrItem] = useState<ArItem | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = (code: string) => `${baseUrl}/ar/${code}`;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ar_experiences" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("โหลดข้อมูลไม่สำเร็จ: " + error.message);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ ...emptyForm, code: genCode() }); setOpen(true); };
  const openEdit = (i: ArItem) => {
    setForm({
      id: i.id, code: i.code, title: i.title, description: i.description || "",
      media_type: i.media_type, media_url: i.media_url, poster_url: i.poster_url || "",
      subject: i.subject || "", grade_level: i.grade_level || "",
      tags: (i.tags || []).join(", "), is_public: i.is_public, is_active: i.is_active,
    });
    setOpen(true);
  };

  const upload = async (file: File, kind: "media" | "poster") => {
    setUploading(kind);
    const ext = file.name.split(".").pop() || "bin";
    const path = `${form.code || genCode()}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("ar-media").upload(path, file, { upsert: true });
    setUploading(null);
    if (error) { toast.error("อัปโหลดไม่สำเร็จ: " + error.message); return; }
    const { data } = supabase.storage.from("ar-media").getPublicUrl(path);
    setForm((f) => ({ ...f, [kind === "media" ? "media_url" : "poster_url"]: data.publicUrl }));
    toast.success("อัปโหลดสำเร็จ");
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("กรุณากรอกชื่อสื่อ"); return; }
    if (!form.media_url.trim()) { toast.error("กรุณาอัปโหลดไฟล์หรือใส่ลิงก์สื่อ"); return; }
    setSaving(true);
    const payload: any = {
      code: (form.code || genCode()).trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      media_type: form.media_type,
      media_url: form.media_url.trim(),
      poster_url: form.poster_url.trim() || null,
      subject: form.subject.trim() || null,
      grade_level: form.grade_level.trim() || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      is_public: form.is_public,
      is_active: form.is_active,
    };
    const q = form.id
      ? supabase.from("ar_experiences" as any).update(payload).eq("id", form.id)
      : supabase.from("ar_experiences" as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error("บันทึกไม่สำเร็จ: " + error.message); return; }
    toast.success("บันทึกสำเร็จ");
    setOpen(false);
    load();
  };

  const remove = async (i: ArItem) => {
    const ok = await confirmDelete(`ลบสื่อ “${i.title}”?`);
    if (!ok) return;
    const { error } = await supabase.from("ar_experiences" as any).delete().eq("id", i.id);
    if (error) { toast.error("ลบไม่สำเร็จ: " + error.message); return; }
    toast.success("ลบแล้ว");
    load();
  };

  const downloadQr = (item: ArItem) => {
    const canvas = qrRef.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `qr-ar-${item.code}.png`;
    a.click();
  };

  const stats = useMemo(() => ({
    total: items.length,
    published: items.filter((i) => i.is_public && i.is_active).length,
    views: items.reduce((s, i) => s + (i.view_count || 0), 0),
  }), [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Boxes className="h-6 w-6 text-primary" />สื่อ AR / QR แหล่งเรียนรู้</h1>
          <p className="text-sm text-muted-foreground">สร้าง QR Code ที่สแกนแล้วแสดงภาพ วิดีโอ หรือโมเดล 3 มิติแบบ AR (เปิดสาธารณะ)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><a href="/ar" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" />ดูหน้าสาธารณะ</a></Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />เพิ่มสื่อ AR</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">สื่อทั้งหมด</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">เผยแพร่แล้ว</p><p className="text-2xl font-bold">{stats.published}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">ยอดเข้าชมรวม</p><p className="text-2xl font-bold">{stats.views}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>รายการสื่อ</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-muted-foreground py-6 text-center">กำลังโหลด...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center">ยังไม่มีสื่อ AR — กด “เพิ่มสื่อ AR” เพื่อเริ่มต้น</p>
          ) : items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 p-3 rounded-lg border flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium">{i.title}</div>
                <div className="text-xs text-muted-foreground">/ar/{i.code}</div>
              </div>
              <Badge variant="outline">{MEDIA_TYPES.find((m) => m.value === i.media_type)?.label || i.media_type}</Badge>
              <Badge variant={i.is_public && i.is_active ? "default" : "secondary"}>{i.is_public && i.is_active ? "เผยแพร่" : "ปิด"}</Badge>
              <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />{i.view_count}</Badge>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setQrItem(i)}><QrCode className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(i)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "แก้ไขสื่อ AR" : "เพิ่มสื่อ AR"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>ชื่อสื่อ *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>รหัส QR (URL)</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^A-Za-z0-9_-]/g, "") })} /></div>
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
              <Label>ลิงก์สื่อ *</Label>
              <div className="flex gap-2">
                <Input value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="อัปโหลดไฟล์ หรือวางลิงก์ (.glb / .mp4 / YouTube)" />
                {form.media_type !== "youtube" && (
                  <Button type="button" variant="outline" disabled={uploading === "media"} asChild>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />{uploading === "media" ? "กำลังอัปโหลด" : "อัปโหลด"}
                      <input type="file" className="hidden"
                        accept={form.media_type === "model3d" ? ".glb,.gltf,model/gltf-binary" : form.media_type === "video" ? "video/*" : "image/*"}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "media"); e.currentTarget.value = ""; }} />
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
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "poster"); e.currentTarget.value = ""; }} />
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
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR */}
      <Dialog open={!!qrItem} onOpenChange={(o) => !o && setQrItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Code สื่อ AR</DialogTitle></DialogHeader>
          {qrItem && (
            <div className="space-y-3 text-center">
              <div ref={qrRef} className="flex justify-center bg-white p-4 rounded-lg">
                <QRCodeCanvas value={publicUrl(qrItem.code)} size={220} includeMargin level="M" />
              </div>
              <div className="font-medium">{qrItem.title}</div>
              <div className="text-xs text-muted-foreground break-all">{publicUrl(qrItem.code)}</div>
              <Button className="w-full" onClick={() => downloadQr(qrItem)}><Download className="h-4 w-4 mr-2" />ดาวน์โหลด QR</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
