import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Laptop, Smartphone, Camera, Tablet, Projector, Package, Upload, ImageIcon, X, Copy } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
import { saveErrorMessage } from "@/lib/saveError";

type Device = {
  id: string;
  asset_code: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  status: string;
  notes?: string | null;
  photo_url?: string | null;
};

const CATEGORIES = [
  { value: "notebook", label: "โน้ตบุ๊ก", icon: Laptop },
  { value: "tablet", label: "แท็บเล็ต", icon: Tablet },
  { value: "mobile", label: "มือถือ", icon: Smartphone },
  { value: "camera", label: "กล้อง", icon: Camera },
  { value: "projector", label: "โปรเจกเตอร์", icon: Projector },
  { value: "other", label: "อื่นๆ", icon: Package },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  available: { label: "พร้อมยืม", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  borrowed: { label: "ถูกยืม", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  maintenance: { label: "ซ่อมบำรุง", cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  lost: { label: "สูญหาย", cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  retired: { label: "ปลดระวาง", cls: "bg-muted text-muted-foreground border-border" },
};

export default function IctDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Partial<Device>>({ category: "notebook", status: "available" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bulkItems, setBulkItems] = useState<{ asset_code: string; serial_number: string }[]>([{ asset_code: "", serial_number: "" }]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("ict_devices").select("*").order("created_at", { ascending: false });
    if (error) toast.error(saveErrorMessage(error));
    setDevices(data || []);
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
    setForm({ category: "notebook", status: "available" });
    setBulkItems([{ asset_code: "", serial_number: "" }]);
    resetPhoto();
    setOpen(true);
  };
  const openEdit = (d: Device) => {
    setEditing(d);
    setForm(d);
    setBulkItems([{ asset_code: d.asset_code, serial_number: d.serial_number || "" }]);
    resetPhoto();
    setPhotoPreview(d.photo_url || null);
    setOpen(true);
  };
  const openAddMore = (d: Device) => {
    setEditing(null);
    setForm({
      category: d.category,
      status: "available",
      name: d.name,
      brand: d.brand,
      model: d.model,
      photo_url: d.photo_url,
    });
    setBulkItems([{ asset_code: "", serial_number: "" }]);
    resetPhoto();
    setPhotoPreview(d.photo_url || null);
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
    const compressed = await compressImage(file, { maxWidth: 1280, maxSizeKB: 200 });
    const path = `ict-devices/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    try {
      return await uploadAssetPhoto(path, compressed);
    } catch (e: any) {
      toast.error("อัปโหลดรูปไม่สำเร็จ: " + (e?.message || ""));
      return null;
    }
  };


  const save = async () => {
    if (!form.name) {
      toast.error("กรุณากรอกชื่ออุปกรณ์");
      return;
    }
    const items = editing
      ? [{ asset_code: (form.asset_code || "").trim(), serial_number: (form.serial_number || "").trim() }]
      : bulkItems.map((b) => ({ asset_code: b.asset_code.trim(), serial_number: b.serial_number.trim() })).filter((b) => b.asset_code);
    if (items.length === 0) {
      toast.error("กรุณากรอกรหัสครุภัณฑ์อย่างน้อย 1 รายการ");
      return;
    }
    const codes = items.map((i) => i.asset_code);
    if (new Set(codes).size !== codes.length) {
      toast.error("รหัสครุภัณฑ์ซ้ำกันในรายการ");
      return;
    }
    setUploading(true);
    let photo_url: string | null | undefined = editing?.photo_url || null;
    if (photoFile) {
      const url = await uploadPhoto(photoFile);
      if (!url) { setUploading(false); return; }
      photo_url = url;
    } else if (!photoPreview) {
      photo_url = null;
    }
    const base: any = {
      name: form.name?.trim(),
      category: form.category || "notebook",
      brand: form.brand || null,
      model: form.model || null,
      status: form.status || "available",
      notes: form.notes || null,
      photo_url,
    };
    if (editing) {
      const { error } = await supabase.from("ict_devices").update({
        ...base,
        asset_code: items[0].asset_code,
        serial_number: items[0].serial_number || null,
      }).eq("id", editing.id);
      if (error) { setUploading(false); return toast.error(saveErrorMessage(error)); }
      toast.success("อัปเดตอุปกรณ์เรียบร้อย");
    } else {
      const rows = items.map((it) => ({ ...base, asset_code: it.asset_code, serial_number: it.serial_number || null }));
      const { error } = await supabase.from("ict_devices").insert(rows);
      if (error) { setUploading(false); return toast.error(saveErrorMessage(error)); }
      toast.success(`เพิ่มอุปกรณ์เรียบร้อย ${rows.length} เครื่อง`);
    }
    setUploading(false);
    setOpen(false);
    load();
  };

  const remove = async (d: Device) => {
    if (!(await swal.confirm({ title: `ลบอุปกรณ์ "${d.name}"?`, danger: true }))) return;
    const { error } = await supabase.from("ict_devices").delete().eq("id", d.id);
    if (error) return toast.error(saveErrorMessage(error));
    toast.success("ลบเรียบร้อย");
    load();
  };

  const filtered = devices.filter((d) => {
    const q = search.toLowerCase();
    return !q || d.name.toLowerCase().includes(q) || d.asset_code.toLowerCase().includes(q) || (d.serial_number || "").toLowerCase().includes(q);
  });

  const stats = {
    total: devices.length,
    available: devices.filter((d) => d.status === "available").length,
    borrowed: devices.filter((d) => d.status === "borrowed").length,
    maintenance: devices.filter((d) => d.status === "maintenance").length,
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">อุปกรณ์ ICT</h1>
          <p className="text-sm text-muted-foreground">จัดการครุภัณฑ์ ICT พร้อมรูปภาพ สำหรับให้ยืม-คืน</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> เพิ่มอุปกรณ์</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ทั้งหมด</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">พร้อมยืม</div><div className="text-2xl font-bold text-emerald-400">{stats.available}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ถูกยืม</div><div className="text-2xl font-bold text-amber-400">{stats.borrowed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">ซ่อมบำรุง</div><div className="text-2xl font-bold text-sky-400">{stats.maintenance}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle>รายการอุปกรณ์</CardTitle>
            <Input placeholder="ค้นหา ชื่อ / รหัส / S/N" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">รูป</TableHead>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อ</TableHead>
                <TableHead>หมวด</TableHead>
                <TableHead>S/N</TableHead>
                <TableHead>ยี่ห้อ/รุ่น</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ยังไม่มีอุปกรณ์</TableCell></TableRow>
              ) : filtered.map((d) => {
                const cat = CATEGORIES.find((c) => c.value === d.category);
                const st = STATUS_LABEL[d.status] || STATUS_LABEL.available;
                const Icon = cat?.icon || Package;
                return (
                  <TableRow key={d.id}>
                    <TableCell>
                      {d.photo_url ? (
                        <img loading="lazy" decoding="async" src={d.photo_url} alt={d.name} className="w-12 h-12 rounded-md object-cover border border-border" />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center text-muted-foreground"><Icon className="w-5 h-5" /></div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{d.asset_code}</TableCell>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{cat?.label || d.category}</TableCell>
                    <TableCell className="font-mono text-xs">{d.serial_number || "-"}</TableCell>
                    <TableCell className="text-sm">{[d.brand, d.model].filter(Boolean).join(" ") || "-"}</TableCell>
                    <TableCell><Badge variant="outline" className={st.cls}>{st.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openAddMore(d)} title="เพิ่มเครื่องในรุ่นนี้"><Copy className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(d)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(d)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์ ICT"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>รูปภาพอุปกรณ์</Label>
              <div className="mt-1 flex items-start gap-3">
                <div className="relative w-28 h-28 rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                  {photoPreview ? (
                    <>
                      <img loading="lazy" decoding="async" src={photoPreview} alt="preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={resetPhoto} className="absolute top-1 right-1 p-0.5 rounded-full bg-background/80 hover:bg-background border border-border">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickPhoto(e.target.files?.[0] || null)} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1" /> เลือกรูปภาพ
                  </Button>
                  <p className="text-xs text-muted-foreground">รูปจะแสดงในหน้าคลังอุปกรณ์ให้ทุกคนเห็น (ไม่เกิน 8MB)</p>
                </div>
              </div>
            </div>
            {editing ? (
              <>
                <div className="col-span-2">
                  <Label>รหัสครุภัณฑ์ *</Label>
                  <Input value={form.asset_code || ""} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} placeholder="เช่น ICT-NB-001" />
                </div>
                <div className="col-span-2">
                  <Label>ชื่ออุปกรณ์ *</Label>
                  <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น Notebook Lenovo ThinkPad" />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <Label>ชื่ออุปกรณ์ / รุ่น *</Label>
                <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น Notebook Lenovo ThinkPad" />
              </div>
            )}
            <div>
              <Label>หมวด</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>สถานะ</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ยี่ห้อ</Label>
              <Input value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div>
              <Label>รุ่น</Label>
              <Input value={form.model || ""} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            {editing ? (
              <div className="col-span-2">
                <Label>Serial Number (S/N)</Label>
                <Input value={form.serial_number || ""} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="ใช้สแกนตอนยืม-คืน" />
              </div>
            ) : (
              <div className="col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>รายการเครื่อง (รหัสครุภัณฑ์ + S/N) *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setBulkItems([...bulkItems, { asset_code: "", serial_number: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> เพิ่มแถว
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">บันทึกหลายเครื่องในรุ่นเดียวกันได้พร้อมกัน</p>
                <div className="space-y-2">
                  {bulkItems.map((it, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder={`รหัสครุภัณฑ์ #${idx + 1}`}
                        value={it.asset_code}
                        onChange={(e) => {
                          const next = [...bulkItems];
                          next[idx] = { ...next[idx], asset_code: e.target.value };
                          setBulkItems(next);
                        }}
                        className="font-mono text-sm"
                      />
                      <Input
                        placeholder="S/N (ถ้ามี)"
                        value={it.serial_number}
                        onChange={(e) => {
                          const next = [...bulkItems];
                          next[idx] = { ...next[idx], serial_number: e.target.value };
                          setBulkItems(next);
                        }}
                        className="font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={bulkItems.length === 1}
                        onClick={() => setBulkItems(bulkItems.filter((_, i) => i !== idx))}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="col-span-2">
              <Label>หมายเหตุ</Label>
              <Input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>ยกเลิก</Button>
            <Button onClick={save} disabled={uploading}>{uploading ? "กำลังบันทึก..." : "บันทึก"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
