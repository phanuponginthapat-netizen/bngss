import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PdfFieldOverlay, TemplateField } from "@/components/templates/PdfFieldOverlay";
import { loadPrintTemplatePdf } from "@/lib/printTemplatePdf";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2, Plus, Loader2, Copy, ArrowDown, ArrowRight, Send, ZoomIn, ZoomOut, Search, List as ListIcon } from "lucide-react";
import { AUTOFILL_SOURCES } from "@/lib/templateAutofill";
import { PDF_FONTS, DEFAULT_FONT } from "@/lib/pdfTemplateFonts";
import { saveErrorMessage } from "@/lib/saveError";


const FIELD_TYPES = ["text", "longtext", "number", "date", "checkbox", "radio", "signature", "image", "autofill"];

const MASTER_CATEGORIES = [
  "จดหมายภายใน",
  "คำสั่ง",
  "ประกาศ",
  "หนังสือรับรอง",
  "ใบลา",
  "ปพ.5",
  "ปพ.6",
  "เกียรติบัตร",
  "ทุน/กสศ.",
  "อื่นๆ",
];

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "admin", label: "ผู้ดูแลระบบ" },
  { value: "director", label: "ผู้อำนวยการ" },
  { value: "teacher", label: "ครู" },
  { value: "student", label: "นักเรียน" },
  { value: "parent", label: "ผู้ปกครอง" },
];


export default function TemplateEditorPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [fieldsFilter, setFieldsFilter] = useState("");
  const [showFieldsList, setShowFieldsList] = useState(true);

  // Master template metadata
  const [isMaster, setIsMaster] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [isDefaultForCategory, setIsDefaultForCategory] = useState(false);
  const [sharedRoles, setSharedRoles] = useState<string[]>(["admin", "director", "teacher"]);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const { data: tpl, isLoading, error: tplError } = useQuery({
    queryKey: ["tpl", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_templates")
        .select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("ไม่พบเทมเพลตนี้ (อาจถูกลบ หรือคุณไม่มีสิทธิ์เข้าถึง)");
      return data;
    },
    retry: false,
  });

  useEffect(() => {
    if (!tpl?.id) return;
    setFields(((tpl?.field_map as any) || []) as TemplateField[]);
    setIsMaster(Boolean((tpl as any)?.is_system_master));
    setCategory(((tpl as any)?.category as string) || "");
    setIsDefaultForCategory(Boolean((tpl as any)?.is_default_for_category));
    setSharedRoles(((tpl as any)?.shared_with_roles as string[]) || ["admin", "director", "teacher"]);
    setPublishedAt(((tpl as any)?.published_at as string) || null);
    if (!tpl?.source_pdf_path) return;
    (async () => {
      try {
        setPdfBytes(null);
        setPdfUrl(null);
        const source = await loadPrintTemplatePdf(tpl.source_pdf_path as string);
        if (source.type === "bytes") setPdfBytes(source.bytes);
        else setPdfUrl(source.url);
      } catch (e: any) {
        toast.error("โหลด PDF ไม่สำเร็จ", { description: e?.message });
      }
    })();
  }, [tpl?.id]);

  const updateField = (fid: string, patch: Partial<TemplateField>) => {
    setFields((arr) => arr.map((f) => (f.id === fid ? { ...f, ...patch } : f)));
  };

  // Keyboard shortcuts on selected field
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      const sel = fields.find((f) => f.id === selectedId);
      if (!sel) return;
      const step = e.shiftKey ? 0.01 : 0.001;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeField(selectedId); }
      else if (e.key === "ArrowUp") { e.preventDefault(); updateField(selectedId, { y: Math.max(0, sel.y - step) }); }
      else if (e.key === "ArrowDown") { e.preventDefault(); updateField(selectedId, { y: Math.min(1 - sel.h, sel.y + step) }); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); updateField(selectedId, { x: Math.max(0, sel.x - step) }); }
      else if (e.key === "ArrowRight") { e.preventDefault(); updateField(selectedId, { x: Math.min(1 - sel.w, sel.x + step) }); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateField(selectedId, "down"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, fields]);


  const uniqueFieldKey = (): string => {
    let n = 1;
    while (fields.some((f) => f.key === `field_${n}`)) n++;
    return `field_${n}`;
  };

  const addField = () => {
    const newF: TemplateField = {
      id: crypto.randomUUID(),
      key: uniqueFieldKey(),
      label: "ช่องใหม่",
      type: "text",
      page: 1,
      x: 0.1, y: 0.1, w: 0.2, h: 0.03,
      options: [],
    };
    setFields([...fields, newF]);
    setSelectedId(newF.id);
  };

  const createFieldFromRect = (rect: { x: number; y: number; w: number; h: number; page: number }) => {
    const newF: TemplateField = {
      id: crypto.randomUUID(),
      key: uniqueFieldKey(),
      label: "ช่องใหม่",
      type: "text",
      page: rect.page,
      x: rect.x, y: rect.y, w: rect.w, h: rect.h,
      options: [],
    };
    setFields((arr) => [...arr, newF]);
    setSelectedId(newF.id);
  };

  const removeField = (fid: string) => {
    setFields((arr) => arr.filter((f) => f.id !== fid));
    if (selectedId === fid) setSelectedId(null);
  };

  const duplicateField = (fid: string, direction: "right" | "down") => {
    const src = fields.find((f) => f.id === fid);
    if (!src) return;
    const dx = direction === "right" ? src.w + 0.005 : 0;
    const dy = direction === "down" ? src.h + 0.005 : 0;
    const nx = Math.min(1 - src.w, src.x + dx);
    const ny = Math.min(1 - src.h, src.y + dy);
    // Suffix key with _2, _3, ...
    const base = src.key.replace(/_(\d+)$/, "");
    let n = 2;
    while (fields.some((f) => f.key === `${base}_${n}`)) n++;
    const clone: TemplateField = {
      ...src,
      id: crypto.randomUUID(),
      key: `${base}_${n}`,
      label: `${src.label} (${n})`,
      x: nx,
      y: ny,
    };
    setFields((arr) => [...arr, clone]);
    setSelectedId(clone.id);
  };

  const save = async () => {
    setSaving(true);
    try {
      const patch: any = {
        field_map: fields as any,
        analyze_status: "done",
        analyze_error: null,
        analyzed_at: new Date().toISOString(),
        is_system_master: isMaster,
        category: category || null,
        is_default_for_category: isMaster ? isDefaultForCategory : false,
        shared_with_roles: sharedRoles,
      };
      const { error } = await supabase.from("print_templates")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      toast.success("บันทึกแล้ว");
      qc.invalidateQueries({ queryKey: ["pdf-templates"] });
      qc.invalidateQueries({ queryKey: ["master-templates"] });
    } catch (e: any) {
      toast.error(saveErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!isMaster) {
      toast.error("เปิด 'ตั้งเป็นต้นแบบระบบ' ก่อน");
      return;
    }
    if (!category) {
      toast.error("เลือกหมวดหมู่ก่อน");
      return;
    }
    setSaving(true);
    try {
      const stamp = new Date().toISOString();
      const patch: any = {
        field_map: fields as any,
        is_system_master: true,
        category,
        is_default_for_category: isDefaultForCategory,
        shared_with_roles: sharedRoles,
        published_at: stamp,
        analyze_status: "done",
      };
      const { error } = await supabase.from("print_templates").update(patch).eq("id", id);
      if (error) throw error;
      setPublishedAt(stamp);
      toast.success("เผยแพร่ต้นแบบสู่ระบบแล้ว");
      qc.invalidateQueries({ queryKey: ["pdf-templates"] });
      qc.invalidateQueries({ queryKey: ["master-templates"] });
    } catch (e: any) {
      toast.error(saveErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const unpublish = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("print_templates")
        .update({ published_at: null } as any).eq("id", id);
      if (error) throw error;
      setPublishedAt(null);
      toast.success("ยกเลิกการเผยแพร่แล้ว");
      qc.invalidateQueries({ queryKey: ["master-templates"] });
    } catch (e: any) {
      toast.error(saveErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (tplError) return (
    <div className="p-8 max-w-md mx-auto text-center space-y-4">
      <p className="text-destructive font-medium">{(tplError as Error).message || "โหลดเทมเพลตไม่สำเร็จ"}</p>
      <Button variant="outline" onClick={() => nav(-1)}><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Button>
    </div>
  );
  if (isLoading || !tpl) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  const selected = fields.find((f) => f.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav("/dashboard/admin/document-templates")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              {tpl.name}
              {isMaster && publishedAt && <Badge className="bg-emerald-600">ต้นแบบระบบ · เผยแพร่แล้ว</Badge>}
              {isMaster && !publishedAt && <Badge variant="outline">ต้นแบบ · ยังไม่เผยแพร่</Badge>}
            </h1>
            <p className="text-xs text-muted-foreground">{fields.length} ช่อง · ลากคลุมพื้นที่บน PDF เพื่อสร้างช่องใหม่</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={addField}><Plus className="w-4 h-4 mr-1" />เพิ่มช่อง</Button>
          {isMaster && (publishedAt ? (
            <Button variant="outline" onClick={unpublish} disabled={saving}>
              ยกเลิกเผยแพร่
            </Button>
          ) : (
            <Button variant="secondary" onClick={publish} disabled={saving}>
              <Send className="w-4 h-4 mr-1" />เผยแพร่สู่ระบบ
            </Button>
          ))}
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}<Save className="w-4 h-4 mr-1" />บันทึก
          </Button>
        </div>
      </div>

      {/* Master template settings card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">ต้นแบบระบบ (System Master)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={isMaster} onCheckedChange={setIsMaster} id="ms" />
            <Label htmlFor="ms" className="text-sm">ตั้งเป็นต้นแบบระบบ</Label>
          </div>
          <div>
            <Label className="text-xs">หมวดหมู่</Label>
            <Select value={category} onValueChange={setCategory} disabled={!isMaster}>
              <SelectTrigger><SelectValue placeholder="เลือกหมวด..." /></SelectTrigger>
              <SelectContent>
                {MASTER_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isDefaultForCategory} onCheckedChange={setIsDefaultForCategory} disabled={!isMaster || !category} id="df" />
            <Label htmlFor="df" className="text-sm">ค่าเริ่มต้นของหมวดนี้</Label>
          </div>
          <div>
            <Label className="text-xs">แชร์ให้บทบาท</Label>
            <div className="flex flex-wrap gap-1 pt-1">
              {ROLE_OPTIONS.map((r) => {
                const active = sharedRoles.includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    disabled={!isMaster}
                    onClick={() => setSharedRoles((arr) => active ? arr.filter((x) => x !== r.value) : [...arr, r.value])}
                    className={`px-2 py-0.5 rounded text-xs border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-muted"} ${!isMaster ? "opacity-50" : ""}`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={`grid grid-cols-1 gap-4 ${showFieldsList ? "lg:grid-cols-[240px_minmax(0,1fr)_360px]" : "lg:grid-cols-[minmax(0,1fr)_360px]"}`}>
        {showFieldsList && (
          <Card className="self-start sticky top-4 max-h-[80vh] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1"><ListIcon className="w-4 h-4" />ช่องทั้งหมด ({fields.length})</CardTitle>
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={fieldsFilter} onChange={(e) => setFieldsFilter(e.target.value)} placeholder="ค้นหา..." className="h-7 pl-6 text-xs" />
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 p-2 space-y-1">
              {Array.from(new Set(fields.map((f) => f.page))).sort((a, b) => a - b).map((pg) => {
                const list = fields.filter((f) => f.page === pg && (!fieldsFilter || f.label.toLowerCase().includes(fieldsFilter.toLowerCase()) || f.key.toLowerCase().includes(fieldsFilter.toLowerCase())));
                if (!list.length) return null;
                return (
                  <div key={pg}>
                    <div className="text-[10px] font-semibold text-muted-foreground px-1 py-1">หน้า {pg}</div>
                    {list.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setSelectedId(f.id)}
                        className={`w-full text-left px-2 py-1 rounded text-xs truncate ${selectedId === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                        title={`${f.label} · ${f.key}`}
                      >
                        <span className="opacity-60">[{f.type}]</span> {f.label}
                      </button>
                    ))}
                  </div>
                );
              })}
              {!fields.length && <p className="text-xs text-muted-foreground text-center p-2">ยังไม่มีช่อง</p>}
            </CardContent>
          </Card>
        )}
        <div className="border rounded-lg bg-muted/30 overflow-auto max-h-[80vh]">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-2 py-1 flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setShowFieldsList((v) => !v)} title="แสดง/ซ่อนรายการช่อง"><ListIcon className="w-3 h-3" /></Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.max(50, z - 10))}><ZoomOut className="w-3 h-3" /></Button>
            <span className="text-xs w-12 text-center tabular-nums">{zoom}%</span>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.min(200, z + 10))}><ZoomIn className="w-3 h-3" /></Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setZoom(100)}>รีเซ็ต</Button>
            <span className="ml-auto text-[10px] text-muted-foreground">คีย์ลัด: ลูกศร=ขยับ · Shift+ลูกศร=ก้าวใหญ่ · Del=ลบ · Ctrl+D=สำเนา</span>
          </div>
          <div className="p-4" style={{ zoom: `${zoom}%` }}>
            <PdfFieldOverlay
              pdfBytes={pdfBytes}
              pdfUrl={pdfUrl}
              fields={fields}
              highlightId={selectedId}
              onFieldClick={setSelectedId}
              editable
              onFieldChange={updateField}
              onCreateField={createFieldFromRect}
            />
          </div>
        </div>


        <Card className="self-start sticky top-4">
          <CardHeader className="pb-3"><CardTitle className="text-base">{selected ? "แก้ไขช่อง" : "เลือกช่องจาก PDF"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {!selected ? (
              <p className="text-sm text-muted-foreground">คลิกกรอบสีบน PDF หรือ <b>ลากคลุมพื้นที่</b> เพื่อสร้างช่องใหม่ทันที</p>
            ) : (
              <>
                <div><Label>ป้ายชื่อ</Label><Input value={selected.label} onChange={(e) => updateField(selected.id, { label: e.target.value })} /></div>
                <div><Label>Key</Label><Input value={selected.key} onChange={(e) => updateField(selected.id, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })} /></div>
                <div><Label>ชนิด</Label>
                  <Select value={selected.type} onValueChange={(v) => updateField(selected.id, { type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>หมวด</Label><Input value={selected.group || ""} onChange={(e) => updateField(selected.id, { group: e.target.value })} /></div>
                {selected.type === "autofill" && (
                  <div>
                    <Label>แหล่งข้อมูล (DMC / ระบบ)</Label>
                    <Select value={selected.data_source || ""} onValueChange={(v) => updateField(selected.id, { data_source: v })}>
                      <SelectTrigger><SelectValue placeholder="เลือกแหล่ง..." /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {Array.from(new Set(AUTOFILL_SOURCES.map(s => s.group))).map(g => (
                          <div key={g}>
                            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground">{g}</div>
                            {AUTOFILL_SOURCES.filter(s => s.group === g).map(s => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(selected.type === "radio" || selected.type === "checkbox") && (
                  <div className="space-y-2">
                    <div><Label>ตัวเลือก (คั่นด้วย ;)</Label>
                      <Input value={(selected.options || []).join(";")} onChange={(e) => updateField(selected.id, { options: e.target.value.split(";").map((s) => s.trim()).filter(Boolean) })} />
                    </div>
                    <div><Label>ค่าที่ใช้ติ๊กช่องนี้</Label>
                      <Input value={selected.value || selected.option || ""} onChange={(e) => updateField(selected.id, { value: e.target.value, option: e.target.value })} placeholder="เช่น ชาย / หญิง / ผ่าน / ไม่ผ่าน" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div><Label className="text-xs">หน้า</Label><Input type="number" min={1} value={selected.page} onChange={(e) => updateField(selected.id, { page: Math.max(1, +e.target.value) })} /></div>
                  <div><Label className="text-xs">X%</Label><Input type="number" step="0.01" value={(selected.x * 100).toFixed(2)} onChange={(e) => updateField(selected.id, { x: +e.target.value / 100 })} /></div>
                  <div><Label className="text-xs">Y%</Label><Input type="number" step="0.01" value={(selected.y * 100).toFixed(2)} onChange={(e) => updateField(selected.id, { y: +e.target.value / 100 })} /></div>
                  <div><Label className="text-xs">W%</Label><Input type="number" step="0.01" value={(selected.w * 100).toFixed(2)} onChange={(e) => updateField(selected.id, { w: +e.target.value / 100 })} /></div>
                </div>
                <div><Label className="text-xs">H%</Label><Input type="number" step="0.01" value={(selected.h * 100).toFixed(2)} onChange={(e) => updateField(selected.id, { h: +e.target.value / 100 })} /></div>
                <div className="grid grid-cols-4 gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => updateField(selected.id, { y: Math.max(0, selected.y - 0.001) })}>↑</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => updateField(selected.id, { y: Math.min(1 - selected.h, selected.y + 0.001) })}>↓</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => updateField(selected.id, { x: Math.max(0, selected.x - 0.001) })}>←</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => updateField(selected.id, { x: Math.min(1 - selected.w, selected.x + 0.001) })}>→</Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => duplicateField(selected.id, "right")}>
                    <ArrowRight className="w-3 h-3 mr-1" />สำเนาแนวนอน
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => duplicateField(selected.id, "down")}>
                    <ArrowDown className="w-3 h-3 mr-1" />สำเนาแนวตั้ง
                  </Button>
                </div>

                {/* Text formatting */}
                {selected.type !== "checkbox" && selected.type !== "image" && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">รูปแบบตัวอักษร</div>
                    <div>
                      <Label className="text-xs">ฟอนต์</Label>
                      <Select value={selected.fontFamily || DEFAULT_FONT} onValueChange={(v) => updateField(selected.id, { fontFamily: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PDF_FONTS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">ขนาด (pt)</Label>
                        <Input type="number" min={6} max={72} value={selected.fontSize ?? ""} placeholder="auto" onChange={(e) => updateField(selected.id, { fontSize: e.target.value ? +e.target.value : undefined })} />
                      </div>
                      <div>
                        <Label className="text-xs">จัดวาง</Label>
                        <Select value={selected.align || "left"} onValueChange={(v) => updateField(selected.id, { align: v as any })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="left">ซ้าย</SelectItem>
                            <SelectItem value="center">กลาง</SelectItem>
                            <SelectItem value="right">ขวา</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">สีตัวอักษร</Label>
                        <Input type="color" value={selected.color || "#000000"} onChange={(e) => updateField(selected.id, { color: e.target.value })} className="h-9 p-1" />
                      </div>
                      <label className="flex items-end gap-2 text-xs pb-2">
                        <input type="checkbox" checked={!!selected.bold} onChange={(e) => updateField(selected.id, { bold: e.target.checked })} />
                        ตัวหนา
                      </label>
                    </div>
                  </div>
                )}


                <Button variant="destructive" size="sm" onClick={() => removeField(selected.id)} className="w-full">
                  <Trash2 className="w-4 h-4 mr-1" />ลบช่องนี้
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
