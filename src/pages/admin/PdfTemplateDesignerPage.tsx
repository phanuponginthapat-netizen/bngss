import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Upload, Save, Plus, Trash2, Copy, Eye, FileSearch, ZoomIn, ZoomOut,
  AlignLeft, AlignCenter, AlignRight, Bold, MoveUp, MoveDown, Pencil, X,
  FileText, MousePointer2, LayoutGrid, Layers, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { BINDING_PRESETS, BINDING_CATALOG } from "@/lib/pdfTemplate/bindings";
import { CATEGORY_LABEL } from "@/lib/pdfTemplate/types";
import { renderPdfTemplate, downloadBlob } from "@/lib/pdfTemplate/renderTemplate";
import type {
  PdfField, PdfFieldType, PdfTemplateCategory, PdfTemplateRecord,
} from "@/lib/pdfTemplate/types";
import { useIsMobile } from "@/hooks/use-mobile";

const PT_PER_PX = 1; // pdfjs gives us pt directly when scale=1
const FIELD_TYPES: { value: PdfFieldType; label: string }[] = [
  { value: "text", label: "ข้อความ" },
  { value: "date", label: "วันที่" },
  { value: "number", label: "ตัวเลข" },
  { value: "currency", label: "จำนวนเงิน" },
  { value: "checkbox", label: "ช่องติ๊ก" },
  { value: "image", label: "รูปภาพ" },
  { value: "signature", label: "ลายเซ็น" },
];

interface PageInfo { width: number; height: number; canvas: HTMLCanvasElement }

export default function PdfTemplateDesignerPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<PdfTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pdf_templates" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("ลบเทมเพลตนี้?")) return;
    await supabase.from("pdf_templates" as any).delete().eq("id", id);
    await logAudit({ action: "pdf_template.delete", target_table: "pdf_templates", target_id: id });
    toast.success("ลบแล้ว");
    load();
  };

  const openEditor = (id: string | "new") => navigate(`/pdf-designer/${id}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSearch className="w-6 h-6 text-primary" />
            PDF Coordinate Designer Pro
          </h1>
          <p className="text-sm text-muted-foreground">
            อัปโหลด PDF แล้ววางพิกัดฟิลด์ เพื่อใช้เป็นเทมเพลตของ E-Form / ปพ. / ทุน / เยี่ยมบ้าน / ใบลา
          </p>
        </div>
        <Button onClick={() => openEditor("new")}>
          <Plus className="w-4 h-4 mr-1" /> สร้างเทมเพลตใหม่
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">เทมเพลตทั้งหมด ({templates.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">กำลังโหลด...</div>
          ) : templates.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              ยังไม่มีเทมเพลต — กด "สร้างเทมเพลตใหม่" เพื่อเริ่มต้น
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((t) => (
                <Card key={t.id} className="hover:shadow-md transition cursor-pointer" onClick={() => openEditor(t.id)}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="font-semibold truncate">{t.name}</div>
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary whitespace-nowrap">
                        {CATEGORY_LABEL[t.category]}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t.page_count} หน้า • {(t.fields || []).length} ฟิลด์
                    </div>
                    {t.description && <div className="text-xs line-clamp-2">{t.description}</div>}
                    <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => openEditor(t.id)}>
                        <Pencil className="w-3 h-3 mr-1" /> เปิดในตัวแก้ไข
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


/* ---------------- Designer Workspace (fullscreen, app-like) ---------------- */

export function DesignerWorkspace({
  initial, onClose, onSaved,
}: { initial: PdfTemplateRecord; onClose: () => void; onSaved: () => void }) {
  const [meta, setMeta] = useState({
    name: initial.name, category: initial.category, description: initial.description ?? "",
  });
  const [fields, setFields] = useState<PdfField[]>(initial.fields || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [sourceUrl, setSourceUrl] = useState(initial.source_pdf_url);
  const [sourcePath, setSourcePath] = useState<string | null>(initial.source_pdf_path);
  const [zoom, setZoom] = useState(1.0);
  const [activePage, setActivePage] = useState(1);
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftW, setLeftW] = useState(260);
  const [rightW, setRightW] = useState(300);

  // Auto-collapse rails on mobile so the canvas gets full width
  useEffect(() => {
    if (isMobile) { setLeftOpen(false); setRightOpen(false); }
    else { setLeftOpen(true); setRightOpen(true); }
  }, [isMobile]);
  const startResize = (side: "left" | "right") => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = side === "left" ? leftW : rightW;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const move = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const next = side === "left" ? startW + delta : startW - delta;
      const clamped = Math.max(180, Math.min(560, next));
      if (side === "left") setLeftW(clamped); else setRightW(clamped);
    };
    const up = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const [isPublic, setIsPublic] = useState<boolean>((initial as any).is_public ?? false);
  const [publicSlug, setPublicSlug] = useState<string | null>((initial as any).public_slug ?? null);
  const [syncTargets, setSyncTargets] = useState<{ home_visit?: boolean; subsidy?: boolean }>(
    ((initial as any).sync_targets as any) || {}
  );


  const sel = useMemo(() => fields.find(f => f.id === selectedId) || null, [fields, selectedId]);

  // Load PDF whenever bytes change
  useEffect(() => {
    if (!pdfBytes && initial.source_pdf_path) {
      (async () => {
        const { data } = await supabase.storage.from("pdf-templates").download(initial.source_pdf_path!);
        if (data) setPdfBytes(await data.arrayBuffer());
      })();
    }
  }, [initial.source_pdf_path, pdfBytes]);

  useEffect(() => {
    if (!pdfBytes) return;
    (async () => {
      const pdfjs: any = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      const doc = await pdfjs.getDocument({ data: pdfBytes.slice(0) }).promise;
      const arr: PageInfo[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width; canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        arr.push({ width: viewport.width, height: viewport.height, canvas });
      }
      setPages(arr);
    })();
  }, [pdfBytes]);

  const handleUpload = async (f: File) => {
    const buf = await f.arrayBuffer();
    setPdfBytes(buf);
    // upload to storage
    const path = `${crypto.randomUUID()}.pdf`;
    const { error } = await supabase.storage.from("pdf-templates")
      .upload(path, new Blob([buf], { type: "application/pdf" }), { upsert: false });
    if (error) { toast.error("อัปโหลดล้มเหลว: " + error.message); return; }
    const { data: pub } = supabase.storage.from("pdf-templates").getPublicUrl(path);
    setSourcePath(path);
    setSourceUrl(pub.publicUrl);
    if (!meta.name) setMeta(m => ({ ...m, name: f.name.replace(/\.pdf$/i, "") }));
    toast.success("อัปโหลดสำเร็จ");
  };

  const addField = (type: PdfFieldType) => {
    const id = crypto.randomUUID();
    const presets = BINDING_PRESETS[meta.category as PdfTemplateCategory] || [];
    const nf: PdfField = {
      id, page: activePage,
      x: 50, y: 50, w: type === "checkbox" ? 16 : 160, h: type === "checkbox" ? 16 : 22,
      type, binding: presets[0]?.path || "{custom.text}",
      label: type, style: { fontSize: 14, align: "left" },
    };
    setFields(prev => [...prev, nf]);
    setSelectedId(id);
  };
  const updateField = (id: string, patch: Partial<PdfField>) =>
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch, style: { ...f.style, ...(patch.style || {}) } } : f));
  const removeField = (id: string) => { setFields(prev => prev.filter(f => f.id !== id)); if (selectedId === id) setSelectedId(null); };
  const cloneField = (id: string) => {
    const src = fields.find(f => f.id === id); if (!src) return;
    const nid = crypto.randomUUID();
    setFields(prev => [...prev, { ...src, id: nid, x: src.x + 10, y: src.y + 10 }]);
    setSelectedId(nid);
  };

  const save = async () => {
    if (!meta.name) { toast.error("ใส่ชื่อเทมเพลต"); return; }
    if (!sourceUrl) { toast.error("กรุณาอัปโหลดไฟล์ PDF"); return; }
    setSaving(true);
    try {
      const payload: any = {
        name: meta.name, category: meta.category, description: meta.description || null,
        source_pdf_url: sourceUrl, source_pdf_path: sourcePath,
        page_count: pages.length || initial.page_count || 1,
        page_width: pages[0]?.width || null, page_height: pages[0]?.height || null,
        fields: fields as any, is_active: true,
        is_public: isPublic,
        public_slug: publicSlug,
        sync_targets: syncTargets,
      };

      if (initial.id) {
        const { error } = await supabase.from("pdf_templates" as any).update(payload).eq("id", initial.id);
        if (error) throw error;
        await logAudit({ action: "pdf_template.update", target_table: "pdf_templates", target_id: initial.id, details: { name: meta.name, fields: fields.length } });
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("pdf_templates" as any).insert({ ...payload, created_by: u.user?.id });
        if (error) throw error;
        await logAudit({ action: "pdf_template.create", target_table: "pdf_templates", details: { name: meta.name } });
      }
      toast.success("บันทึกเทมเพลตเรียบร้อย");
      onSaved();
    } catch (e: any) {
      toast.error("บันทึกล้มเหลว: " + e.message);
    } finally { setSaving(false); }
  };

  const preview = async () => {
    if (!sourceUrl) { toast.error("ยังไม่มีไฟล์"); return; }
    const sample: Record<string, any> = {
      student: { full_name: "ด.ช.ทดสอบ ระบบ", student_code: "12345", classroom: "ป.6/1", id_card: "1234567890123", birth_date: "12 มี.ค. 2557" },
      academic: { year: "2568", semester: "1" },
      school: { name: "โรงเรียนทดสอบ" },
      director: { name: "นายผู้อำนวยการ ทดสอบ" },
      form: { title: meta.name, date: new Date().toLocaleDateString("th-TH") },
      user: { full_name: "ผู้ใช้งาน ทดสอบ", position: "ครู" },
      scholarship: { name: "ทุนทดสอบ", amount: 5000, date: new Date().toLocaleDateString("th-TH") },
      visit: { date: new Date().toLocaleDateString("th-TH"), address: "—", guardian_name: "—", guardian_phone: "—", relation: "บิดา", notes: "—", economic: "พอเพียง" },
      teacher: { name: "ครูประจำชั้น" },
      leave: { applicant: "ผู้ขอลา", type: "ลากิจ", from: "—", to: "—", days: 1, reason: "—", contact: "—" },
      guardian: { name: "ผู้ปกครอง" },
      custom: { text: "[ตัวอย่าง]" },
    };
    const rec: PdfTemplateRecord = {
      ...initial, ...meta, fields, source_pdf_url: sourceUrl, source_pdf_path: sourcePath,
      page_count: pages.length, page_width: pages[0]?.width || null, page_height: pages[0]?.height || null,
    } as any;
    const blob = await renderPdfTemplate(rec, sample);
    downloadBlob(blob, `preview_${meta.name || "template"}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900 text-neutral-100 select-none">
      {/* App title bar */}
      <div className="h-11 px-3 flex items-center justify-between gap-3 bg-neutral-950 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow">
            <FileSearch className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[11px] text-neutral-400">PDF Designer Pro</span>
            <span className="text-sm font-medium truncate max-w-[40vw]">
              {meta.name || "ยังไม่ตั้งชื่อ"} {initial.id && <span className="text-neutral-500 text-xs">• แก้ไข</span>}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="text-neutral-200 hover:bg-neutral-800" onClick={preview}>
            <Eye className="w-4 h-4 mr-1" /> ดูตัวอย่าง
          </Button>
          <Button size="sm" className="bg-rose-600 hover:bg-rose-500 text-white" onClick={save} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
          <Button size="sm" variant="ghost" className="text-neutral-300 hover:bg-neutral-800" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Toolbar ribbon */}
      <div className="h-10 bg-neutral-900 border-b border-neutral-800 flex items-center gap-1 px-2 shrink-0 overflow-x-auto">
        <label className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-neutral-800 cursor-pointer">
          <Upload className="w-3.5 h-3.5" /> เปิดไฟล์ PDF
          <input type="file" accept="application/pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </label>
        <div className="w-px h-6 bg-neutral-800 mx-1" />
        <span className="text-[11px] text-neutral-500 px-1">เพิ่มฟิลด์:</span>
        {FIELD_TYPES.map(t => (
          <button key={t.value}
            onClick={() => addField(t.value)}
            className="text-xs px-2 py-1 rounded hover:bg-neutral-800 flex items-center gap-1">
            <Plus className="w-3 h-3" /> {t.label}
          </button>
        ))}
        <div className="w-px h-6 bg-neutral-800 mx-1" />
        <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="p-1.5 rounded hover:bg-neutral-800"><ZoomOut className="w-3.5 h-3.5" /></button>
        <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1.5 rounded hover:bg-neutral-800"><ZoomIn className="w-3.5 h-3.5" /></button>
        <button onClick={() => setZoom(1)} className="text-[11px] px-2 py-1 rounded hover:bg-neutral-800">100%</button>
        <div className="flex-1" />
        <div className="text-[11px] text-neutral-500">{fields.length} ฟิลด์ • {pages.length} หน้า</div>
      </div>

      <div
        className="flex-1 grid min-h-0 relative"
        style={{
          gridTemplateColumns: isMobile
            ? `0px 0px 1fr 0px 0px`
            : `${leftOpen ? `${leftW}px` : "0px"} ${leftOpen ? "4px" : "0px"} 1fr ${rightOpen ? "4px" : "0px"} ${rightOpen ? `${rightW}px` : "0px"}`,
          transition: "none",
        }}
      >
        {/* Left rail */}
        <aside
          className={`border-r border-neutral-800 bg-neutral-950/60 overflow-y-auto ${leftOpen ? "" : "invisible"} ${isMobile ? "fixed left-0 top-[84px] bottom-0 z-40 w-[85vw] max-w-[320px] shadow-2xl" : ""}`}
          style={isMobile && !leftOpen ? { display: "none" } : undefined}
        >

          <Section title="ข้อมูลเทมเพลต" icon={<FileText className="w-3.5 h-3.5" />}>
            <Field label="ชื่อ">
              <Input className="h-8 bg-neutral-900 border-neutral-700 text-neutral-100" value={meta.name} onChange={e => setMeta(m => ({ ...m, name: e.target.value }))} />
            </Field>
            <Field label="หมวด">
              <Select value={meta.category} onValueChange={(v) => setMeta(m => ({ ...m, category: v as PdfTemplateCategory }))}>
                <SelectTrigger className="h-8 bg-neutral-900 border-neutral-700 text-neutral-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CATEGORY_LABEL) as [string, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="คำอธิบาย">
              <Textarea rows={2} className="bg-neutral-900 border-neutral-700 text-neutral-100" value={meta.description} onChange={e => setMeta(m => ({ ...m, description: e.target.value }))} />
            </Field>
            {sourceUrl && (
              <div className="text-[10px] text-neutral-500 truncate px-1">✓ {sourcePath || sourceUrl}</div>
            )}
          </Section>

          <Section title="หน้าเอกสาร" icon={<LayoutGrid className="w-3.5 h-3.5" />}>
            <div className="grid grid-cols-3 gap-2 px-1">
              {pages.map((p, i) => (
                <button key={i}
                  onClick={() => setActivePage(i + 1)}
                  className={`relative border rounded overflow-hidden hover:border-rose-500 ${activePage === i + 1 ? "border-rose-500 ring-2 ring-rose-500/40" : "border-neutral-700"}`}>
                  <img src={p.canvas.toDataURL()} className="w-full h-auto bg-white" />
                  <span className="absolute bottom-0 right-0 text-[9px] bg-black/70 px-1 rounded-tl">{i + 1}</span>
                </button>
              ))}
              {pages.length === 0 && <div className="col-span-3 text-[11px] text-neutral-500 text-center py-2">ยังไม่มี PDF</div>}
            </div>
          </Section>

          <Section title={`เลเยอร์ฟิลด์ (${fields.length})`} icon={<Layers className="w-3.5 h-3.5" />}>
            <div className="space-y-0.5">
              {fields.map(f => (
                <button key={f.id}
                  onClick={() => { setSelectedId(f.id); setActivePage(f.page); }}
                  className={`w-full text-left text-[11px] px-2 py-1 rounded flex items-center gap-1 ${selectedId === f.id ? "bg-rose-600/20 text-rose-200" : "hover:bg-neutral-800 text-neutral-300"}`}>
                  <span className="font-mono text-[9px] bg-neutral-800 px-1 rounded">{f.type}</span>
                  <span className="truncate flex-1">{f.binding}</span>
                  <span className="text-neutral-500 text-[9px]">p{f.page}</span>
                </button>
              ))}
              {fields.length === 0 && <div className="text-[11px] text-neutral-500 text-center py-2">ยังไม่มีฟิลด์</div>}
            </div>
          </Section>
          <Section title="เผยแพร่ฟอร์ม" icon={<Eye className="w-3.5 h-3.5" />}>
            <div className="space-y-2 px-1">
              <label className="flex items-center justify-between text-xs">
                <span>เปิดลิงก์สาธารณะ</span>
                <Switch
                  checked={isPublic}
                  onCheckedChange={(v) => {
                    setIsPublic(v);
                    if (v && !publicSlug) {
                      const s = (meta.name || "form")
                        .toLowerCase()
                        .replace(/[^a-z0-9ก-๙]+/gi, "-")
                        .replace(/^-+|-+$/g, "")
                        .slice(0, 30) + "-" + Math.random().toString(36).slice(2, 7);
                      setPublicSlug(s);
                    }
                  }}
                />
              </label>
              {isPublic && publicSlug && (
                <div className="space-y-1">
                  <div className="text-[10px] text-neutral-500">ลิงก์ให้ครู/นักเรียนกรอก:</div>
                  <div className="flex gap-1">
                    <Input
                      readOnly
                      className="h-7 bg-neutral-900 border-neutral-700 text-neutral-100 text-[10px] font-mono"
                      value={`${window.location.origin}/public-form/${publicSlug}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 border-neutral-700 hover:bg-neutral-800"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/public-form/${publicSlug}`);
                        toast.success("คัดลอกลิงก์แล้ว");
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="text-[10px] text-amber-400">* อย่าลืมกด "บันทึก" เพื่อใช้งานลิงก์</div>
                </div>
              )}
              <div className="border-t border-neutral-800 pt-2 space-y-1">
                <div className="text-[10px] text-neutral-500">เมื่อมีคนส่งฟอร์ม ให้ซิงค์เข้า:</div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={!!syncTargets.home_visit}
                    onChange={(e) => setSyncTargets((s) => ({ ...s, home_visit: e.target.checked }))}
                  />
                  ตารางเยี่ยมบ้าน (home_visits)
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={!!syncTargets.subsidy}
                    onChange={(e) => setSyncTargets((s) => ({ ...s, subsidy: e.target.checked }))}
                  />
                  ตารางทุนนักเรียน (student_subsidies)
                </label>
              </div>
            </div>
          </Section>
        </aside>

        {/* Left resizer */}
        <div
          onMouseDown={startResize("left")}
          className={`${leftOpen ? "" : "hidden"} cursor-col-resize bg-neutral-800 hover:bg-rose-600/60 transition-colors`}
          title="ลากเพื่อปรับขนาด"
        />

        {/* Center canvas */}

        <main
          className="overflow-auto bg-neutral-800 relative touch-pan-x touch-pan-y"
          id="pdf-canvas-area"
          onMouseDown={(e) => {
            // Pan with middle mouse, or left click on empty backdrop (not on a PDF field/canvas)
            const target = e.target as HTMLElement;
            const onField = target.closest("[data-pdf-field]");
            const onCanvas = target.tagName === "CANVAS";
            const isMiddle = e.button === 1;
            if (!isMiddle && (onField || onCanvas)) return;
            if (e.button !== 0 && !isMiddle) return;
            const el = e.currentTarget;
            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = el.scrollLeft;
            const startTop = el.scrollTop;
            el.style.cursor = "grabbing";
            e.preventDefault();
            const move = (ev: MouseEvent) => {
              el.scrollLeft = startLeft - (ev.clientX - startX);
              el.scrollTop = startTop - (ev.clientY - startY);
            };
            const up = () => {
              el.style.cursor = "";
              window.removeEventListener("mousemove", move);
              window.removeEventListener("mouseup", up);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
          }}
          style={{ cursor: pages.length ? "grab" : undefined }}
        >

          {/* Floating toggles */}
          <button
            onClick={() => setLeftOpen(v => !v)}
            className="absolute top-2 left-2 z-10 p-1.5 rounded bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border border-neutral-700"
            title={leftOpen ? "ซ่อนแถบซ้าย" : "แสดงแถบซ้าย"}
          >
            {leftOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setRightOpen(v => !v)}
            className="absolute top-2 right-2 z-10 p-1.5 rounded bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 border border-neutral-700"
            title={rightOpen ? "ซ่อนแถบขวา" : "แสดงแถบขวา"}
          >
            {rightOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>

          {pages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400">
              <div className="w-20 h-20 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
                <Upload className="w-10 h-10 opacity-60" />
              </div>
              <div className="text-lg font-medium">เปิดไฟล์ PDF เพื่อเริ่มออกแบบ</div>
              <div className="text-xs mt-1 text-neutral-500">รองรับ A4 / Letter / กำหนดเอง • หลายหน้า</div>
              <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white cursor-pointer">
                <Upload className="w-4 h-4" /> เลือก PDF
                <input type="file" accept="application/pdf" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              </label>
            </div>
          ) : (
            <div className="min-h-full min-w-max flex items-start justify-center p-8">
              <PageCanvas
                page={pages[activePage - 1]}
                pageNumber={activePage}
                zoom={zoom}
                fields={fields.filter(f => f.page === activePage)}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onUpdate={updateField}
                onAddAt={(x, y) => {
                  const id = crypto.randomUUID();
                  const presets = BINDING_PRESETS[meta.category as PdfTemplateCategory] || [];
                  setFields(prev => [...prev, {
                    id, page: activePage, x, y, w: 160, h: 22, type: "text",
                    binding: presets[0]?.path || "{custom.text}",
                    style: { fontSize: 14, align: "left" },
                  }]);
                  setSelectedId(id);
                }}
              />
            </div>
          )}
        </main>

        {/* Right resizer */}
        <div
          onMouseDown={startResize("right")}
          className={`${rightOpen ? "" : "hidden"} cursor-col-resize bg-neutral-800 hover:bg-rose-600/60 transition-colors`}
          title="ลากเพื่อปรับขนาด"
        />

        {/* Right inspector */}
        <aside
          className={`border-l border-neutral-800 bg-neutral-950/60 overflow-y-auto ${rightOpen ? "" : "invisible"} ${isMobile ? "fixed right-0 top-[84px] bottom-0 z-40 w-[85vw] max-w-[320px] shadow-2xl" : ""}`}
          style={isMobile && !rightOpen ? { display: "none" } : undefined}
        >
          {!sel ? (
            <div className="text-xs text-neutral-500 text-center py-12 px-4">
              <MousePointer2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              เลือกฟิลด์เพื่อดู properties<br />
              <span className="text-[10px]">หรือคลิก-ลากบนหน้า PDF เพื่อสร้างฟิลด์ใหม่</span>
            </div>
          ) : (
            <div className="p-3">
              <FieldInspector
                field={sel}
                category={meta.category as PdfTemplateCategory}
                pageCount={pages.length}
                onChange={(p) => updateField(sel.id, p)}
                onDelete={() => removeField(sel.id)}
                onClone={() => cloneField(sel.id)}
              />
            </div>
          )}
        </aside>
      </div>

      {/* Status bar */}
      <div className="h-6 px-3 flex items-center justify-between text-[10px] text-neutral-500 bg-neutral-950 border-t border-neutral-800 shrink-0">
        <span>หน้า {activePage} / {pages.length || 1} • zoom {Math.round(zoom * 100)}%</span>
        <span>พิกัด PDF point (1pt = 1/72") — แปลงอัตโนมัติเวลา render</span>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-800 py-2 px-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 px-1 py-1 flex items-center gap-1">{icon}{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-1">
      <div className="text-[10px] text-neutral-400 mb-0.5">{label}</div>
      {children}
    </div>
  );
}

/* ---------------- Page Canvas ---------------- */

function PageCanvas({
  page, pageNumber, zoom, fields, selectedId, onSelect, onUpdate, onAddAt,
}: {
  page: PageInfo; pageNumber: number; zoom: number;
  fields: PdfField[]; selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PdfField>) => void;
  onAddAt: (x: number, y: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragInfo, setDragInfo] = useState<null | {
    id: string; mode: "move" | "resize"; startX: number; startY: number;
    origX: number; origY: number; origW: number; origH: number;
  }>(null);

  // Mount canvas image into container
  useEffect(() => {
    const c = containerRef.current?.querySelector(".pdf-img") as HTMLDivElement | null;
    if (c) {
      c.innerHTML = "";
      const img = new Image();
      img.src = page.canvas.toDataURL();
      img.style.width = `${page.width * zoom}px`;
      img.style.height = `${page.height * zoom}px`;
      img.style.display = "block";
      c.appendChild(img);
    }
  }, [page, zoom]);

  const onMouseDownField = (e: React.MouseEvent, f: PdfField, mode: "move" | "resize") => {
    e.preventDefault(); e.stopPropagation();
    onSelect(f.id);
    setDragInfo({ id: f.id, mode, startX: e.clientX, startY: e.clientY, origX: f.x, origY: f.y, origW: f.w, origH: f.h });
  };

  useEffect(() => {
    if (!dragInfo) return;
    const move = (e: MouseEvent) => {
      const dx = (e.clientX - dragInfo.startX) / zoom;
      const dy = (e.clientY - dragInfo.startY) / zoom;
      if (dragInfo.mode === "move") {
        onUpdate(dragInfo.id, { x: Math.max(0, dragInfo.origX + dx), y: Math.max(0, dragInfo.origY + dy) });
      } else {
        onUpdate(dragInfo.id, { w: Math.max(8, dragInfo.origW + dx), h: Math.max(8, dragInfo.origH + dy) });
      }
    };
    const up = () => setDragInfo(null);
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [dragInfo, zoom, onUpdate]);

  // create field by drag-rect on blank area
  const createRef = useRef<null | { x: number; y: number }>(null);
  const onMouseDownBg = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".pdf-field")) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    createRef.current = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  };
  const onMouseUpBg = (e: React.MouseEvent) => {
    if (!createRef.current) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x2 = (e.clientX - rect.left) / zoom;
    const y2 = (e.clientY - rect.top) / zoom;
    const dx = x2 - createRef.current.x;
    const dy = y2 - createRef.current.y;
    if (Math.abs(dx) > 6 && Math.abs(dy) > 6) {
      // creating new field — extend onAddAt to size? we'll just add at origin
      onAddAt(Math.min(createRef.current.x, x2), Math.min(createRef.current.y, y2));
    }
    createRef.current = null;
  };

  return (
    <div ref={containerRef} className="inline-block shadow-lg bg-white">
      <div className="relative pdf-img"
        style={{ width: page.width * zoom, height: page.height * zoom }}
        onMouseDown={onMouseDownBg}
        onMouseUp={onMouseUpBg}
      >
        {fields.map(f => {
          const isSel = selectedId === f.id;
          return (
            <div key={f.id}
              className={`pdf-field absolute border ${isSel ? "border-primary border-2" : "border-blue-500 border-dashed"} bg-blue-500/10 cursor-move`}
              style={{
                left: f.x * zoom, top: f.y * zoom,
                width: f.w * zoom, height: f.h * zoom,
                fontSize: (f.style?.fontSize || 14) * zoom * 0.9,
                fontWeight: f.style?.bold ? 700 : 400,
                textAlign: f.style?.align || "left",
                color: f.style?.color || "#1d4ed8",
                lineHeight: `${f.h * zoom}px`,
                overflow: "hidden", whiteSpace: "nowrap",
                paddingLeft: 2, paddingRight: 2,
              }}
              onMouseDown={e => onMouseDownField(e, f, "move")}
            >
              <span className="pointer-events-none">{f.type === "checkbox" ? "☐" : f.binding}</span>
              {isSel && (
                <div
                  className="absolute right-0 bottom-0 w-3 h-3 bg-primary cursor-se-resize"
                  onMouseDown={e => onMouseDownField(e, f, "resize")}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Field Inspector ---------------- */

function FieldInspector({
  field, category, pageCount, onChange, onDelete, onClone,
}: {
  field: PdfField; category: PdfTemplateCategory; pageCount: number;
  onChange: (p: Partial<PdfField>) => void;
  onDelete: () => void; onClone: () => void;
}) {
  const presets = BINDING_PRESETS[category] || [];
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="font-semibold text-sm">รายละเอียดฟิลด์</div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onClone}><Copy className="w-3 h-3" /></Button>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
        </div>
      </div>

      <div>
        <Label>ประเภท</Label>
        <Select value={field.type} onValueChange={(v) => onChange({ type: v as PdfFieldType })}>
          <SelectTrigger className="h-8 bg-neutral-900 border-neutral-700 text-neutral-100"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Binding (ข้อมูลที่จะใส่)</Label>
        <Input className="h-8 bg-neutral-900 border-neutral-700 text-neutral-100" value={field.binding} onChange={e => onChange({ binding: e.target.value })} />
        <Select value="" onValueChange={(v) => onChange({ binding: v })}>
          <SelectTrigger className="h-8 mt-1 bg-neutral-900 border-neutral-700 text-neutral-100 text-[11px]">
            <SelectValue placeholder="เลือกจากรายการ DMC / ระบบ…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {BINDING_CATALOG.map(group => (
              <div key={group.group}>
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-500 sticky top-0 bg-popover">
                  {group.group}
                </div>
                {group.items.map(p => (
                  <SelectItem key={p.path} value={p.path} className="text-xs">
                    <span className="text-neutral-200">{p.label}</span>
                    <span className="ml-2 text-[10px] text-neutral-500 font-mono">{p.path}</span>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-1 mt-1">
          {presets.slice(0, 6).map(p => (
            <button key={p.path} type="button"
              onClick={() => onChange({ binding: p.path })}
              className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>X (pt)</Label>
          <Input type="number" className="h-8 bg-neutral-900 border-neutral-700 text-neutral-100" value={Math.round(field.x)} onChange={e => onChange({ x: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Y (pt)</Label>
          <Input type="number" className="h-8 bg-neutral-900 border-neutral-700 text-neutral-100" value={Math.round(field.y)} onChange={e => onChange({ y: Number(e.target.value) })} />
        </div>
        <div>
          <Label>กว้าง</Label>
          <Input type="number" className="h-8 bg-neutral-900 border-neutral-700 text-neutral-100" value={Math.round(field.w)} onChange={e => onChange({ w: Number(e.target.value) })} />
        </div>
        <div>
          <Label>สูง</Label>
          <Input type="number" className="h-8 bg-neutral-900 border-neutral-700 text-neutral-100" value={Math.round(field.h)} onChange={e => onChange({ h: Number(e.target.value) })} />
        </div>
      </div>

      <div>
        <Label>หน้า</Label>
        <Select value={String(field.page)} onValueChange={(v) => onChange({ page: Number(v) })}>
          <SelectTrigger className="h-8 bg-neutral-900 border-neutral-700 text-neutral-100"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: pageCount }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>หน้า {i + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {field.type !== "checkbox" && field.type !== "image" && field.type !== "signature" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>ขนาดอักษร (pt)</Label>
              <Input type="number" className="h-8 bg-neutral-900 border-neutral-700 text-neutral-100" value={field.style?.fontSize || 14}
                onChange={e => onChange({ style: { fontSize: Number(e.target.value) } as any })} />
            </div>
            <div>
              <Label>สี</Label>
              <Input type="color" value={field.style?.color || "#000000"}
                onChange={e => onChange({ style: { color: e.target.value } as any })} />
            </div>
          </div>
          <div className="flex gap-1">
            {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Ic]) => (
              <Button key={a} size="sm" variant={field.style?.align === a ? "default" : "outline"}
                onClick={() => onChange({ style: { align: a } as any })}>
                <Ic className="w-3 h-3" />
              </Button>
            ))}
            <Button size="sm" variant={field.style?.bold ? "default" : "outline"}
              onClick={() => onChange({ style: { bold: !field.style?.bold } as any })}>
              <Bold className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={!!field.multiline} onCheckedChange={(v) => onChange({ multiline: v })} />
            <Label>หลายบรรทัด</Label>
          </div>
        </>
      )}
    </div>
  );
}
