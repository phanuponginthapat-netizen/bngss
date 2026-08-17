import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Award, Plus, Save, Trash2, Upload, Image as ImageIcon, Type, Copy, Printer,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";
import { compressImage } from "@/lib/imageCompress";
import {
  CertificateRenderer, CERT_FONTS, CERT_TOKENS, defaultFields,
  type CertField, type CertTemplate,
} from "@/components/certificates/CertificateRenderer";
import { saveErrorMessage } from "@/lib/saveError";

const db = supabase as any;
const uid = () => `f_${Math.random().toString(36).slice(2, 9)}`;

const emptyTemplate = (): CertTemplate & { description?: string; is_default?: boolean } => ({
  name: "เกียรติบัตรใหม่",
  background_url: null,
  paper: "A4",
  orientation: "landscape",
  font_family: "Sarabun, sans-serif",
  fields: defaultFields(),
});

const SAMPLE = {
  name: "เด็กชายสมชาย ใจดี",
  award: "ได้รับรางวัลชนะเลิศ",
  rank: "ชนะเลิศ",
  activity: "การแข่งขันตอบปัญหาวิชาการ",
  class: "ป.6/1",
  date: "๑ กันยายน ๒๕๖๙",
  cert_no: "0001/2569",
  school: "โรงเรียนบ้านนางาม",
  signer_name: "(นายผู้อำนวยการ โรงเรียน)",
  signer_position: "ผู้อำนวยการโรงเรียน",
};

export default function CertificateDesignerPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(emptyTemplate());
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(760);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["certificate_templates"],
    queryFn: async () => {
      const { data, error } = await db
        .from("certificate_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasW(Math.max(320, el.clientWidth - 8)));
    ro.observe(el);
    setCanvasW(Math.max(320, el.clientWidth - 8));
    return () => ro.disconnect();
  }, []);

  const field = useMemo(
    () => (editing.fields || []).find((f: CertField) => f.id === selected) || null,
    [editing, selected],
  );

  const patchField = (id: string, patch: Partial<CertField>) =>
    setEditing((t: any) => ({
      ...t,
      fields: (t.fields || []).map((f: CertField) => (f.id === id ? { ...f, ...patch } : f)),
    }));

  // ── ลากวางข้อความ ──
  const onFieldPointerDown = (id: string, e: React.PointerEvent) => {
    e.preventDefault();
    setSelected(id);
    const f = (editing.fields || []).find((x: CertField) => x.id === id);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!f || !rect) return;
    dragRef.current = {
      id,
      dx: ((e.clientX - rect.left) / rect.width) * 100 - f.x,
      dy: ((e.clientY - rect.top) / rect.height) * 100 - f.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!d || !rect) return;
      const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100 - d.dx));
      const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100 - d.dy));
      patchField(d.id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [editing]);

  const addField = () => {
    const f: CertField = {
      id: uid(), label: "ข้อความใหม่", text: "ข้อความ",
      x: 50, y: 50, width: 60, fontSize: 20, fontFamily: editing.font_family,
      color: "#111827", bold: false, italic: false, align: "center", letterSpacing: 0, lineHeight: 1.4,
    };
    setEditing((t: any) => ({ ...t, fields: [...(t.fields || []), f] }));
    setSelected(f.id);
  };

  const uploadBackground = async (file: File) => {
    setUploading(true);
    try {
      const compressed = await compressImage(file, { maxWidth: 2000, quality: 0.9 });
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const res = await uploadPublicFileWithFallback(
        "certificate-assets",
        `backgrounds/${Date.now()}.${ext}`,
        compressed,
        { contentType: file.type || "image/jpeg", upsert: true },
      );
      setEditing((t: any) => ({ ...t, background_url: res.publicUrl }));
      toast.success("อัปโหลดพื้นหลังแล้ว");
    } catch (e: any) {
      toast.error(e?.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!editing.name?.trim()) return toast.error("กรุณาตั้งชื่อเทมเพลต");
    const payload = {
      name: editing.name,
      description: editing.description || null,
      background_url: editing.background_url || null,
      paper: editing.paper || "A4",
      orientation: editing.orientation,
      font_family: editing.font_family,
      fields: editing.fields,
      is_default: !!editing.is_default,
    };
    const { data: u } = await supabase.auth.getUser();
    const q = editing.id
      ? db.from("certificate_templates").update(payload).eq("id", editing.id).select().single()
      : db.from("certificate_templates").insert({ ...payload, created_by: u?.user?.id }).select().single();
    const { data, error } = await q;
    if (error) return toast.error(saveErrorMessage(error));
    setEditing(data);
    qc.invalidateQueries({ queryKey: ["certificate_templates"] });
    toast.success("บันทึกเทมเพลตแล้ว");
  };

  const remove = async (id: string) => {
    const { error } = await db.from("certificate_templates").delete().eq("id", id);
    if (error) return toast.error(saveErrorMessage(error));
    if (editing.id === id) setEditing(emptyTemplate());
    qc.invalidateQueries({ queryKey: ["certificate_templates"] });
    toast.success("ลบแล้ว");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" /> ออกแบบเกียรติบัตร
          </h1>
          <p className="text-sm text-muted-foreground">
            อัปโหลดพื้นหลัง ลากวางข้อความ กำหนดฟอนต์ ขนาด และสี แล้วนำไปพิมพ์หลายใบพร้อมกัน
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard/certificates/print")}>
            <Printer className="w-4 h-4 mr-1" /> ไปหน้าพิมพ์
          </Button>
          <Button onClick={save}><Save className="w-4 h-4 mr-1" /> บันทึก</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)_280px] gap-3 xl:gap-4 w-full max-w-full">
        {/* รายการเทมเพลต */}
        <Card className="min-w-0">

          <CardContent className="p-3 space-y-2">
            <Button size="sm" className="w-full" variant="secondary"
              onClick={() => { setEditing(emptyTemplate()); setSelected(null); }}>
              <Plus className="w-4 h-4 mr-1" /> เทมเพลตใหม่
            </Button>
            <div className="space-y-1 max-h-[60vh] overflow-auto">
              {templates.map((t: any) => (
                <div key={t.id}
                  className={`p-2 rounded-md border text-sm cursor-pointer flex items-center justify-between gap-1 ${
                    editing.id === t.id ? "border-primary bg-accent/50" : "hover:bg-accent/30"
                  }`}
                  onClick={() => { setEditing({ ...t, fields: t.fields || [] }); setSelected(null); }}>
                  <span className="truncate">{t.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {t.is_default && <Badge variant="secondary" className="text-[10px]">ค่าเริ่มต้น</Badge>}
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); const c = { ...t, id: undefined, name: `${t.name} (คัดลอก)` }; setEditing(c); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                      onClick={(e) => { e.stopPropagation(); remove(t.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีเทมเพลต</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ผืนผ้าใบ */}
        <Card className="min-w-0 overflow-hidden">

          <CardContent className="p-3 space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs">ชื่อเทมเพลต</Label>
                <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">แนวกระดาษ</Label>
                <Select value={editing.orientation} onValueChange={(v) => setEditing({ ...editing, orientation: v })}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">A4 แนวนอน</SelectItem>
                    <SelectItem value="portrait">A4 แนวตั้ง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ฟอนต์หลัก</Label>
                <Select value={editing.font_family} onValueChange={(v) => setEditing({ ...editing, font_family: v })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CERT_FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBackground(f); e.currentTarget.value = ""; }} />
                <Button asChild size="sm" variant="outline" disabled={uploading}>
                  <span><Upload className="w-4 h-4 mr-1" />{uploading ? "กำลังอัปโหลด..." : "พื้นหลัง"}</span>
                </Button>
              </label>
              {editing.background_url && (
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, background_url: null })}>
                  <ImageIcon className="w-4 h-4 mr-1" /> ล้างพื้นหลัง
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={addField}>
                <Type className="w-4 h-4 mr-1" /> เพิ่มข้อความ
              </Button>
            </div>

            <div ref={wrapRef} className="w-full overflow-auto rounded-md border bg-muted/30 p-1">
              <CertificateRenderer
                ref={canvasRef}
                template={editing}
                data={SAMPLE}
                widthPx={canvasW}
                selectedFieldId={selected}
                onFieldPointerDown={onFieldPointerDown}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              ตัวแปรที่ใช้ได้: {CERT_TOKENS.map((t) => `{{${t.key}}}=${t.label}`).join(" · ")}
            </p>
          </CardContent>
        </Card>

        {/* คุณสมบัติข้อความ */}
        <Card className="min-w-0">
          <CardContent className="p-3 space-y-3 max-w-full overflow-x-hidden">

            {!field && <p className="text-sm text-muted-foreground">คลิกข้อความบนเกียรติบัตรเพื่อแก้ไข</p>}
            {field && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">{field.label}</Label>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                    onClick={() => {
                      setEditing((t: any) => ({ ...t, fields: t.fields.filter((f: CertField) => f.id !== field.id) }));
                      setSelected(null);
                    }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div>
                  <Label className="text-xs">ชื่อกล่อง</Label>
                  <Input value={field.label} onChange={(e) => patchField(field.id, { label: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">ข้อความ / ตัวแปร</Label>
                  <Textarea rows={3} value={field.text} onChange={(e) => patchField(field.id, { text: e.target.value })} />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {CERT_TOKENS.map((t) => (
                      <Badge key={t.key} variant="outline" className="cursor-pointer text-[10px]"
                        onClick={() => patchField(field.id, { text: `${field.text}{{${t.key}}}` })}>
                        {t.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">ขนาด (pt) — {field.fontSize}</Label>
                    <Slider min={8} max={80} step={1} value={[field.fontSize]}
                      onValueChange={([v]) => patchField(field.id, { fontSize: v })} />
                  </div>
                  <div>
                    <Label className="text-xs">ความกว้าง (%) — {field.width}</Label>
                    <Slider min={10} max={100} step={1} value={[field.width]}
                      onValueChange={([v]) => patchField(field.id, { width: v })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">ฟอนต์</Label>
                  <Select value={field.fontFamily} onValueChange={(v) => patchField(field.id, { fontFamily: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CERT_FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="color" className="w-14 h-9 p-1" value={field.color}
                    onChange={(e) => patchField(field.id, { color: e.target.value })} />
                  <Button size="icon" variant={field.bold ? "default" : "outline"}
                    onClick={() => patchField(field.id, { bold: !field.bold })}><Bold className="w-4 h-4" /></Button>
                  <Button size="icon" variant={field.italic ? "default" : "outline"}
                    onClick={() => patchField(field.id, { italic: !field.italic })}><Italic className="w-4 h-4" /></Button>
                  <Button size="icon" variant={field.align === "left" ? "default" : "outline"}
                    onClick={() => patchField(field.id, { align: "left" })}><AlignLeft className="w-4 h-4" /></Button>
                  <Button size="icon" variant={field.align === "center" ? "default" : "outline"}
                    onClick={() => patchField(field.id, { align: "center" })}><AlignCenter className="w-4 h-4" /></Button>
                  <Button size="icon" variant={field.align === "right" ? "default" : "outline"}
                    onClick={() => patchField(field.id, { align: "right" })}><AlignRight className="w-4 h-4" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">ตำแหน่ง X (%)</Label>
                    <Input type="number" value={field.x}
                      onChange={(e) => patchField(field.id, { x: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">ตำแหน่ง Y (%)</Label>
                    <Input type="number" value={field.y}
                      onChange={(e) => patchField(field.id, { y: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">ระยะห่างตัวอักษร</Label>
                    <Input type="number" value={field.letterSpacing}
                      onChange={(e) => patchField(field.id, { letterSpacing: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">ระยะบรรทัด</Label>
                    <Input type="number" step="0.1" value={field.lineHeight}
                      onChange={(e) => patchField(field.id, { lineHeight: Number(e.target.value) })} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
