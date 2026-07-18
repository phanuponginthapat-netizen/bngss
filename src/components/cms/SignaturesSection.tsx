import { useRef, useState } from "react";
import { useAllSignatures, type DirectorSignature } from "@/hooks/useSignatures";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { compressImage } from "@/lib/imageCompress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Upload, Star, StarOff, FileSignature, Eraser, Power, PowerOff,
} from "lucide-react";
import { confirmDelete } from "@/lib/confirmAction";

const POSITIONS = [
  "ผู้อำนวยการโรงเรียน",
  "รองผู้อำนวยการโรงเรียน",
  "รักษาราชการแทนผู้อำนวยการ",
  "หัวหน้ากลุ่มสาระการเรียนรู้",
  "หัวหน้างานวิชาการ",
  "หัวหน้างานบริหารทั่วไป",
];

interface Form {
  id?: string;
  name: string;
  position: string;
  signature_url: string;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  notes: string;
}

const emptyForm = (): Form => ({
  name: "", position: "ผู้อำนวยการโรงเรียน", signature_url: "",
  is_default: false, is_active: true, display_order: 0, notes: "",
});

const SignaturesSection = () => {
  const { data: signatures = [], isLoading } = useAllSignatures();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef({ isDown: false, lastX: 0, lastY: 0 });

  const openAdd = () => { setForm(emptyForm()); setDialogOpen(true); };
  const openEdit = (s: DirectorSignature) => {
    setForm({
      id: s.id, name: s.name, position: s.position, signature_url: s.signature_url,
      is_default: s.is_default, is_active: s.is_active, display_order: s.display_order,
      notes: s.notes || "",
    });
    setDialogOpen(true);
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("รองรับเฉพาะไฟล์รูปภาพ"); return; }
    try {
      // บีบให้ไม่เกิน ~120KB เพื่อเก็บใน column TEXT ได้ปลอดภัย
      const compressed = await compressImage(file, { maxWidth: 800, maxHeight: 400, quality: 0.9, mimeType: "image/png", maxSizeKB: 150 });
      const reader = new FileReader();
      reader.onload = () => setForm((f) => ({ ...f, signature_url: String(reader.result || "") }));
      reader.readAsDataURL(compressed);
    } catch (e: any) {
      toast.error("อ่านไฟล์ไม่สำเร็จ: " + (e?.message || ""));
    }
  };

  // ── Canvas signature pad ─────────────────────────────────────────────────
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current; if (!c) return;
    c.setPointerCapture(e.pointerId);
    const rect = c.getBoundingClientRect();
    drawingRef.current = {
      isDown: true,
      lastX: (e.clientX - rect.left) * (c.width / rect.width),
      lastY: (e.clientY - rect.top) * (c.height / rect.height),
    };
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current.isDown) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const rect = c.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (c.width / rect.width);
    const y = (e.clientY - rect.top) * (c.height / rect.height);
    ctx.strokeStyle = "#0a1f4d";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(drawingRef.current.lastX, drawingRef.current.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    drawingRef.current.lastX = x;
    drawingRef.current.lastY = y;
  };
  const endDraw = () => { drawingRef.current.isDown = false; };
  const clearCanvas = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
  };
  const useCanvas = () => {
    const c = canvasRef.current; if (!c) return;
    const dataUrl = c.toDataURL("image/png");
    setForm((f) => ({ ...f, signature_url: dataUrl }));
    setDrawing(false);
    toast.success("ใช้ลายเซ็นจากการวาดแล้ว");
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("กรุณากรอกชื่อ"); return; }
    if (!form.signature_url) { toast.error("กรุณาอัปโหลดหรือวาดลายเซ็น"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        position: form.position.trim() || "ผู้อำนวยการโรงเรียน",
        signature_url: form.signature_url,
        is_default: form.is_default,
        is_active: form.is_active,
        display_order: form.display_order,
        notes: form.notes || null,
      };
      if (form.id) {
        const { error } = await supabase.from("director_signatures").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("director_signatures").insert(payload);
        if (error) throw error;
      }
      toast.success("บันทึกลายเซ็นเรียบร้อย");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["director_signatures"] });
      qc.invalidateQueries({ queryKey: ["director_signatures_all"] });
    } catch (e: any) {
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDelete("ยืนยันลบลายเซ็นนี้?"))) return;
    const { error } = await supabase.from("director_signatures").delete().eq("id", id);
    if (error) { toast.error("ลบไม่สำเร็จ: " + error.message); return; }
    toast.success("ลบเรียบร้อย");
    qc.invalidateQueries({ queryKey: ["director_signatures"] });
    qc.invalidateQueries({ queryKey: ["director_signatures_all"] });
  };

  const setDefault = async (id: string) => {
    const { error } = await supabase.from("director_signatures").update({ is_default: true }).eq("id", id);
    if (error) { toast.error("ตั้งค่าไม่สำเร็จ"); return; }
    toast.success("ตั้งเป็นลายเซ็นหลักแล้ว");
    qc.invalidateQueries({ queryKey: ["director_signatures"] });
    qc.invalidateQueries({ queryKey: ["director_signatures_all"] });
  };

  const toggleActive = async (s: DirectorSignature) => {
    const { error } = await supabase.from("director_signatures").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) { toast.error("เปลี่ยนสถานะไม่สำเร็จ"); return; }
    qc.invalidateQueries({ queryKey: ["director_signatures"] });
    qc.invalidateQueries({ queryKey: ["director_signatures_all"] });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" /> ลายเซ็นผู้บริหาร
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            อัปโหลดหรือวาดลายเซ็น ผอ. / รองฯ — จะถูกใช้แทรกอัตโนมัติใน ปพ.1-8, หนังสือราชการ, ใบลา, E-Form ที่อนุมัติแล้ว
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} size="sm"><Plus className="w-4 h-4 mr-1" /> เพิ่มลายเซ็น</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? "แก้ไขลายเซ็น" : "เพิ่มลายเซ็นใหม่"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ชื่อ-นามสกุล</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="นายสมชาย ใจดี" />
                </div>
                <div className="space-y-1.5">
                  <Label>ตำแหน่ง</Label>
                  <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} list="position-list" />
                  <datalist id="position-list">
                    {POSITIONS.map((p) => <option key={p} value={p} />)}
                  </datalist>
                </div>
              </div>

              <div className="space-y-2">
                <Label>ลายเซ็น</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 bg-muted/20">
                  {form.signature_url ? (
                    <div className="space-y-2">
                      <div className="bg-white rounded p-3 flex items-center justify-center min-h-20">
                        <img src={form.signature_url} alt="ตัวอย่าง" className="max-h-24 object-contain" />
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setForm({ ...form, signature_url: "" })}>
                        <Eraser className="w-3.5 h-3.5 mr-1" /> ล้างและเลือกใหม่
                      </Button>
                    </div>
                  ) : drawing ? (
                    <div className="space-y-2">
                      <canvas
                        ref={canvasRef}
                        width={600}
                        height={200}
                        className="bg-white rounded border w-full touch-none cursor-crosshair"
                        onPointerDown={startDraw}
                        onPointerMove={moveDraw}
                        onPointerUp={endDraw}
                        onPointerLeave={endDraw}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={useCanvas}>ใช้ลายเซ็นนี้</Button>
                        <Button size="sm" variant="outline" onClick={clearCanvas}>ล้าง</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDrawing(false)}>ยกเลิก</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 justify-center">
                      <label className="cursor-pointer">
                        <input
                          type="file" accept="image/png,image/jpeg" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                        />
                        <Button size="sm" variant="outline" asChild>
                          <span><Upload className="w-4 h-4 mr-1" /> อัปโหลดรูป PNG/JPG</span>
                        </Button>
                      </label>
                      <Button size="sm" variant="outline" onClick={() => { setDrawing(true); setTimeout(clearCanvas, 50); }}>
                        <Pencil className="w-4 h-4 mr-1" /> วาดด้วยเมาส์/ปากกา
                      </Button>
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">
                    แนะนำ: PNG พื้นหลังโปร่งใส ขนาด ~600x200px (จะถูกบีบอัดอัตโนมัติ)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ลำดับการแสดง</Label>
                  <Input type="number" value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5">
                  <Label>หมายเหตุ</Label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="เช่น ใช้สำหรับเอกสารวิชาการ" />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
                  <Label>ตั้งเป็นลายเซ็นหลัก</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>เปิดใช้งาน</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : signatures.length === 0 ? (
        <Card className="p-8 text-center">
          <FileSignature className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">ยังไม่มีลายเซ็น — เพิ่มลายเซ็นแรกเพื่อให้ระบบใช้ในเอกสารทั้งหมด</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {signatures.map((s) => (
            <Card key={s.id} className={`p-4 ${!s.is_active ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{s.name}</p>
                    {s.is_default && <Badge variant="default" className="text-[10px]"><Star className="w-3 h-3 mr-1" />หลัก</Badge>}
                    {!s.is_active && <Badge variant="secondary" className="text-[10px]">ปิดใช้งาน</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.position}</p>
                  {s.notes && <p className="text-[11px] text-muted-foreground mt-0.5 italic">{s.notes}</p>}
                </div>
              </div>
              <div className="bg-white rounded border mt-3 p-2 flex items-center justify-center min-h-16">
                <img src={s.signature_url} alt={s.name} className="max-h-16 object-contain" />
              </div>
              <div className="flex gap-1 mt-3 flex-wrap">
                <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> แก้ไข
                </Button>
                {!s.is_default && (
                  <Button size="sm" variant="ghost" onClick={() => setDefault(s.id)}>
                    <StarOff className="w-3.5 h-3.5 mr-1" /> ตั้งเป็นหลัก
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => toggleActive(s)}>
                  {s.is_active ? <PowerOff className="w-3.5 h-3.5 mr-1" /> : <Power className="w-3.5 h-3.5 mr-1" />}
                  {s.is_active ? "ปิด" : "เปิด"}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SignaturesSection;
