import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, DoorOpen, Image as ImageIcon, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
import { saveErrorMessage } from "@/lib/saveError";

type Room = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  capacity: number | null;
  image_url: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
};

const COLORS = ["emerald", "sky", "violet", "amber", "rose", "indigo", "teal", "fuchsia"];
// Static class maps — dynamic `bg-${color}-500` is purged by Tailwind and won't render.
const COLOR_SWATCH: Record<string, string> = {
  emerald: "bg-emerald-500", sky: "bg-sky-500", violet: "bg-violet-500", amber: "bg-amber-500",
  rose: "bg-rose-500", indigo: "bg-indigo-500", teal: "bg-teal-500", fuchsia: "bg-fuchsia-500",
};
const COLOR_TILE: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-500", sky: "bg-sky-500/10 text-sky-500",
  violet: "bg-violet-500/10 text-violet-500", amber: "bg-amber-500/10 text-amber-500",
  rose: "bg-rose-500/10 text-rose-500", indigo: "bg-indigo-500/10 text-indigo-500",
  teal: "bg-teal-500/10 text-teal-500", fuchsia: "bg-fuchsia-500/10 text-fuchsia-500",
};

export default function SpecialRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState<Partial<Room>>({ color: "emerald", is_active: true, sort_order: 0 });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("special_rooms")
      .select("*")
      .order("sort_order")
      .order("name");
    if (error) toast.error(saveErrorMessage(error));
    setRooms((data as Room[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview((prev) => { if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev); return null; });
    if (fileRef.current) fileRef.current.value = "";
  };

  const openNew = () => {
    setEditing(null);
    setForm({ color: "emerald", is_active: true, sort_order: rooms.length });
    resetPhoto();
    setOpen(true);
  };

  const openEdit = (r: Room) => {
    setEditing(r);
    setForm(r);
    resetPhoto();
    setPhotoPreview(r.image_url || null);
    setOpen(true);
  };

  const onPickPhoto = (f: File | null) => {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกิน 8MB"); return; }
    setPhotoFile(f);
    setPhotoPreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  };

  const uploadPhoto = async (file: File): Promise<string | null> => {
    const { compressImage } = await import("@/lib/imageCompress");
    const { uploadAssetPhoto } = await import("@/lib/assetPhotoUrl");
    const compressed = await compressImage(file, { maxWidth: 1280, maxSizeKB: 250 });
    const path = `special-rooms/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    try {
      return await uploadAssetPhoto(path, compressed);
    } catch (e: any) {
      toast.error("อัปโหลดรูปไม่สำเร็จ: " + (e?.message || ""));
      return null;
    }
  };


  const save = async () => {
    if (!form.name?.trim()) { toast.error("กรุณากรอกชื่อห้อง"); return; }
    setSaving(true);
    let image_url: string | null | undefined = editing?.image_url || null;
    if (photoFile) {
      const url = await uploadPhoto(photoFile);
      if (!url) { setSaving(false); return; }
      image_url = url;
    } else if (!photoPreview) {
      image_url = null;
    }
    const payload: any = {
      name: form.name.trim(),
      description: form.description?.toString().trim() || null,
      location: form.location?.toString().trim() || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      color: form.color || "emerald",
      is_active: form.is_active ?? true,
      sort_order: Number(form.sort_order) || 0,
      image_url,
    };
    if (editing) {
      const { error } = await supabase.from("special_rooms").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(saveErrorMessage(error)); }
      toast.success("อัปเดตห้องเรียบร้อย");
    } else {
      const { error } = await supabase.from("special_rooms").insert(payload);
      if (error) { setSaving(false); return toast.error(saveErrorMessage(error)); }
      toast.success("เพิ่มห้องเรียบร้อย");
    }
    setSaving(false);
    setOpen(false);
    load();
  };

  const remove = async (r: Room) => {
    if (!(await swal.confirm({ title: `ลบห้อง "${r.name}"?`, text: "การจองห้องนี้จะไม่ถูกลบ แต่จะไม่ผูกกับห้อง", danger: true }))) return;
    const { error } = await supabase.from("special_rooms").delete().eq("id", r.id);
    if (error) return toast.error(saveErrorMessage(error));
    toast.success("ลบเรียบร้อย");
    load();
  };

  const toggleActive = async (r: Room) => {
    const { error } = await supabase.from("special_rooms").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) return toast.error(saveErrorMessage(error));
    load();
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DoorOpen className="w-6 h-6 text-primary" /> จัดการห้องพิเศษ
          </h1>
          <p className="text-sm text-muted-foreground">เพิ่ม/แก้ไขห้องพิเศษที่เปิดให้ครูจองใช้งาน เช่น Learning Center, ห้องคอม, ห้องวิทยาศาสตร์</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> เพิ่มห้องพิเศษ</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>รายการห้องพิเศษ ({rooms.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">รูป</TableHead>
                <TableHead>ชื่อห้อง</TableHead>
                <TableHead>สถานที่</TableHead>
                <TableHead className="text-center">ความจุ</TableHead>
                <TableHead className="text-center">ลำดับ</TableHead>
                <TableHead className="text-center">สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">กำลังโหลด…</TableCell></TableRow>
              ) : rooms.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">ยังไม่มีห้องพิเศษ — กด "เพิ่มห้องพิเศษ" เพื่อเริ่ม</TableCell></TableRow>
              ) : rooms.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.image_url ? (
                      <img loading="lazy" decoding="async" src={r.image_url} alt={r.name} className="w-14 h-14 object-cover rounded-md border" />
                    ) : (
                      <div className={`w-14 h-14 rounded-md border flex items-center justify-center ${COLOR_TILE[r.color || "emerald"] || COLOR_TILE.emerald}`}>
                        <DoorOpen className="w-6 h-6" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    {r.description && <div className="text-xs text-muted-foreground line-clamp-2 max-w-xs">{r.description}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{r.location || "-"}</TableCell>
                  <TableCell className="text-center text-sm">{r.capacity ?? "-"}</TableCell>
                  <TableCell className="text-center text-sm">{r.sort_order}</TableCell>
                  <TableCell className="text-center">
                    <button onClick={() => toggleActive(r)}>
                      <Badge variant="outline" className={r.is_active ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" : "bg-muted text-muted-foreground"}>
                        {r.is_active ? "เปิดใช้" : "ปิด"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" aria-label="แก้ไขห้อง" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="ลบห้อง" onClick={() => remove(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "แก้ไขห้องพิเศษ" : "เพิ่มห้องพิเศษ"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ชื่อห้อง *</Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น ห้อง Learning Center, ห้องคอม 1" />
            </div>
            <div>
              <Label>คำอธิบาย</Label>
              <Textarea rows={3} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="อุปกรณ์ในห้อง สิ่งอำนวยความสะดวก ฯลฯ" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>สถานที่</Label>
                <Input value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="เช่น อาคาร 2 ชั้น 3" />
              </div>
              <div>
                <Label>ความจุ (คน)</Label>
                <Input type="number" min={0} value={form.capacity ?? ""} onChange={(e) => setForm({ ...form, capacity: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>ลำดับการแสดง</Label>
                <Input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </div>
              <div>
                <Label>สีประจำห้อง</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full border-2 ${COLOR_SWATCH[c]} ${form.color === c ? "border-foreground ring-2 ring-offset-1" : "border-transparent"}`}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>เปิดให้จอง</Label>
                <p className="text-xs text-muted-foreground">ปิดเมื่อต้องการระงับการจองห้องนี้ชั่วคราว</p>
              </div>
              <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            <div>
              <Label>รูปห้อง</Label>
              <div className="flex items-center gap-3 mt-1">
                {photoPreview ? (
                  <div className="relative">
                    <img loading="lazy" decoding="async" src={photoPreview} alt="preview" className="w-24 h-24 rounded-md border object-cover" />
                    <button type="button" onClick={resetPhoto} className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-1" /> เลือกรูป
                </Button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPickPhoto(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึก"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
