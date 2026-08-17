import { useState, useMemo, useEffect } from "react";
import { useCmsValue } from "@/hooks/useCmsSettings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Save, Eye, Plus, Trash2, History, RotateCcw, Printer, FileCode, Copy, Upload, AlertTriangle, CheckCircle2, Wand2, Maximize2, Minimize2, BookTemplate } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";
import { useUserRole } from "@/hooks/useUserRole";
import {
  PrintTemplate,
  renderTemplate,
  buildPageCss,
  printWithTemplate,
  lintTemplate,
  extractVariables,
  LintIssue,
} from "@/lib/printTemplate";
import { PRINT_PRESETS, presetsForCode } from "@/lib/printTemplatePresets";
import OverlayDesigner from "@/components/admin/print-templates/OverlayDesigner";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import WordLikeEditor from "@/components/admin/print-templates/WordLikeEditor";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { tokenThaiLabel } from "@/lib/print-template-tokens";
import { saveErrorMessage } from "@/lib/saveError";

const TEMPLATE_CODES = [
  { code: "transcript", label: "ปพ.1 ระเบียนแสดงผลการเรียน" },
  { code: "pp2", label: "ปพ.2 ประกาศนียบัตร / วุฒิบัตร" },
  { code: "pp3", label: "ปพ.3 รายงานผู้สำเร็จการศึกษา" },
  { code: "pp4", label: "ปพ.4 แบบแสดงผลการเรียนรายวิชา" },
  { code: "pp5", label: "ปพ.5 บันทึกผลการพัฒนา" },
  { code: "pp6", label: "ปพ.6 รายงานผลรายบุคคล" },
  { code: "pp7", label: "ปพ.7 ใบรับรองผลการเรียน" },
  { code: "pp8", label: "ปพ.8 ระเบียนสะสมรายบุคคล" },
  { code: "report_card", label: "สมุดรายงานประจำตัว" },
  { code: "certificate", label: "เกียรติบัตร" },
  { code: "id_card", label: "บัตรประจำตัว" },
  { code: "official_letter", label: "หนังสือราชการทั่วไป" },
];

const TOKEN_HINTS = [
  "{{school.name}}",
  "{{school.address}}",
  "{{class.label}}",
  "{{semester}}",
  "{{beYear year}}",
  "{{thaiDate today}}",
  "{{student.full_name}}",
  "{{#each students}} ... {{/each}}",
];

const PrintTemplatesPage = () => {
  const qc = useQueryClient();
  const { isAdmin, isDirector } = useUserRole();
  const canEdit = isAdmin || isDirector;
  const cmsSchoolName = useCmsValue("school_name");
  const cmsSchoolAddress = useCmsValue("school_address");

  const { data: templates = [] } = useQuery({
    queryKey: ["print_templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("print_templates" as any)
        .select("*")
        .order("code")
        .order("name");
      return (data || []) as unknown as PrintTemplate[];
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PrintTemplate | null>(null);
  const [tab, setTab] = useState("design");
  const [fullscreen, setFullscreen] = useState(false);
  useBodyScrollLock(fullscreen);
  const [showPreviewPane, setShowPreviewPane] = useState(false);

  useEffect(() => {
    if (!selectedId && templates.length) setSelectedId(templates[0].id);
  }, [templates, selectedId]);

  useEffect(() => {
    const t = templates.find((x) => x.id === selectedId);
    if (t) setDraft({ ...t });
  }, [selectedId, templates]);

  useEffect(() => {
    if (!fullscreen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [fullscreen]);

  const previewHtml = useMemo(() => {
    if (!draft) return "";
    const data = { ...(draft.sample_data || {}), today: new Date().toISOString() };
    const css = buildPageCss(draft);
    const body = renderTemplate(draft, data);
    const PAPER: Record<string, [number, number]> = {
      A4: [210, 297], A5: [148, 210], A6: [105, 148], letter: [216, 279],
    };
    const [pw, ph] = PAPER[draft.paper] || PAPER.A4;
    const [w, h] = draft.orientation === "landscape" ? [ph, pw] : [pw, ph];
    const isOverlay = !!draft.overlay_mode && !!draft.background_url;
    const screenCss = `
      html,body{margin:0;padding:0;background:#e5e7eb;}
      .pt-stage{padding:12px;display:flex;justify-content:center;}
      .pt-paper{
        width:${w}mm; min-height:${h}mm; background:#fff;
        box-shadow:0 2px 12px rgba(0,0,0,.15);
        padding:${isOverlay ? 0 : `${draft.margin_top}mm ${draft.margin_right}mm ${draft.margin_bottom}mm ${draft.margin_left}mm`};
        ${isOverlay ? `background-image:url('${draft.background_url}');background-size:100% 100%;background-repeat:no-repeat;position:relative;` : ""}
        box-sizing:border-box; overflow:hidden;
      }
    `;
    return `<!doctype html><html><head><meta charset="utf-8"><base href="${window.location.origin}/"><style>${screenCss}${css}</style></head><body><div class="pt-stage"><div class="pt-paper">${body}</div></div></body></html>`;
  }, [draft]);


  const save = async () => {
    if (!draft) return;
    if (!canEdit) return toast.error("เฉพาะ admin/director เท่านั้น");
    const { id, version, created_at, updated_at, ...patch } = draft as any;
    const { error } = await supabase
      .from("print_templates" as any)
      .update(patch)
      .eq("id", draft.id);
    if (error) return toast.error(saveErrorMessage(error));
    toast.success("บันทึกแล้ว");
    qc.invalidateQueries({ queryKey: ["print_templates"] });
  };

  const createTemplate = async () => {
    const { default: Swal } = await import("sweetalert2");
    const r1 = await Swal.fire({ title: "รหัสฟอร์ม (เช่น pp5, certificate)", input: "text" });
    const code = (r1.value || "").trim();
    if (!code) return;
    const r2 = await Swal.fire({ title: "ชื่อฟอร์ม", input: "text" });
    const name = (r2.value || "").trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("print_templates" as any)
      .insert({
        code,
        name,
        body_html: "<h2>{{school.name}}</h2>",
        sample_data: { school: { name: cmsSchoolName || "โรงเรียนตัวอย่าง", address: cmsSchoolAddress || "" } },
        is_default: false,
      } as any)
      .select()
      .single();
    if (error) return toast.error(saveErrorMessage(error));
    toast.success("สร้างแล้ว");
    qc.invalidateQueries({ queryKey: ["print_templates"] });
    setSelectedId((data as any).id);
  };

  const removeTemplate = async () => {
    if (!draft) return;
    const ok = await swal.confirm({ title: `ลบฟอร์ม "${draft.name}"?`, danger: true });

    if (!ok) return;
    const { error } = await supabase
      .from("print_templates" as any)
      .delete()
      .eq("id", draft.id);
    if (error) return toast.error(saveErrorMessage(error));
    toast.success("ลบแล้ว");
    setSelectedId(null);
    qc.invalidateQueries({ queryKey: ["print_templates"] });
  };

  const setDefault = async () => {
    if (!draft) return;
    // Clear other defaults of same code first
    const { error: clearErr } = await supabase
      .from("print_templates" as any)
      .update({ is_default: false } as any)
      .eq("code", draft.code)
      .neq("id", draft.id);
    if (clearErr) return toast.error(clearErr.message);
    const { error } = await supabase
      .from("print_templates" as any)
      .update({ is_default: true } as any)
      .eq("id", draft.id);
    if (error) return toast.error(saveErrorMessage(error));
    toast.success("ตั้งเป็นฟอร์มหลักแล้ว");
    qc.invalidateQueries({ queryKey: ["print_templates"] });
  };

  const testPrint = () => {
    if (!draft) return;
    printWithTemplate(draft, { ...(draft.sample_data || {}), today: new Date().toISOString() });
  };

  const updateDraft = <K extends keyof PrintTemplate>(k: K, v: PrintTemplate[K]) => {
    if (!draft) return;
    setDraft({ ...draft, [k]: v });
  };

  const insertToken = (tok: string) => {
    if (!draft) return;
    const field = tab === "header" ? "header_html" : tab === "footer" ? "footer_html" : "body_html";
    updateDraft(field as any, ((draft as any)[field] || "") + tok);
  };

  // Lint + variable suggestions
  const issues: LintIssue[] = useMemo(() => (draft ? lintTemplate(draft) : []), [draft]);
  const errorCount = issues.filter((i) => i.level === "error").length;
  const warnCount = issues.filter((i) => i.level === "warn").length;
  const variableSuggestions = useMemo(
    () => (draft?.sample_data ? extractVariables(draft.sample_data) : []),
    [draft?.sample_data]
  );

  // Load a preset into current draft (preserves id/code/name unless empty)
  const loadPreset = async (presetKey: string) => {
    if (!draft) return;
    const p = PRINT_PRESETS.find((x) => x.key === presetKey);
    if (!p) return;
    const ok = await swal.confirm({ title: `โหลดต้นแบบ "${p.label}" ทับเนื้อหาปัจจุบัน?`, text: "ยังไม่บันทึกจนกว่าจะกดบันทึก" });
    if (!ok) return;
    setDraft({
      ...draft,
      body_html: p.body_html,
      header_html: p.header_html ?? draft.header_html,
      footer_html: p.footer_html ?? draft.footer_html,
      css: p.css ?? draft.css,
      paper: (p.paper ?? draft.paper) as any,
      orientation: (p.orientation ?? draft.orientation) as any,
      sample_data: p.sample_data ?? draft.sample_data,
    });
    toast.success("โหลดต้นแบบแล้ว — แก้ไขแล้วกด บันทึก");
  };

  // Duplicate
  const duplicate = async () => {
    if (!draft) return;
    const { id, version, created_at, updated_at, ...rest } = draft as any;
    const { data, error } = await supabase
      .from("print_templates" as any)
      .insert({ ...rest, name: `${draft.name} (สำเนา)`, is_default: false } as any)
      .select()
      .single();
    if (error) return toast.error(saveErrorMessage(error));
    toast.success("คัดลอกแล้ว");
    qc.invalidateQueries({ queryKey: ["print_templates"] });
    setSelectedId((data as any).id);
  };

  // Upload background image
  const uploadBg = async (file: File) => {
    if (!draft) return;
    try {
      const path = `print-templates/${draft.id}/${Date.now()}-${file.name}`;
      const { publicUrl } = await uploadPublicFileWithFallback("cms-images", path, file);
      updateDraft("background_url" as any, publicUrl as any);
      toast.success("อัปโหลดพื้นหลังแล้ว");
    } catch (e: any) {
      toast.error(e.message || "อัปโหลดไม่สำเร็จ");
    }
  };

  // Versions
  const { data: versions = [] } = useQuery({
    queryKey: ["print_template_versions", draft?.id],
    enabled: !!draft?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("print_template_versions" as any)
        .select("*")
        .eq("template_id", draft!.id)
        .order("version", { ascending: false })
        .limit(30);
      return (data || []) as any[];
    },
  });

  const restoreVersion = async (v: any) => {
    if (!draft) return;
    const ok = await swal.confirm({ title: `กู้คืนเป็นเวอร์ชัน ${v.version}?` });
    if (!ok) return;
    const snap = v.snapshot || {};
    setDraft({ ...draft, ...snap });
    toast.success("โหลดเวอร์ชันแล้ว — กด บันทึก เพื่อยืนยัน");
  };


  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileCode className="w-6 h-6" /> ฟอร์มพิมพ์ (Print Templates)
          </h1>
          <p className="text-sm text-muted-foreground">
            ออกแบบฟอร์มพิมพ์เอกสาร เช่น ปพ.5/6, เกียรติบัตร, บัตรประจำตัว — ใช้ Handlebars syntax
          </p>
        </div>
        {canEdit && (
          <Button onClick={createTemplate}>
            <Plus className="w-4 h-4 mr-2" /> สร้างฟอร์มใหม่
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4">
        {/* Sidebar list */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">รายการฟอร์ม</CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
            {TEMPLATE_CODES.map((c) => {
              const list = templates.filter((t) => t.code === c.code);
              return (
                <div key={c.code} className="px-2 py-1.5 border-b">
                  <div className="text-xs font-medium text-muted-foreground mb-1 px-2">
                    {c.label} · <code>{c.code}</code>
                  </div>
                  {list.length === 0 && (
                    <div className="text-xs text-muted-foreground px-2 py-1 italic">— ยังไม่มี —</div>
                  )}
                  {list.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between ${
                        selectedId === t.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                      }`}
                    >
                      <span className="truncate">{t.name}</span>
                      <div className="flex gap-1">
                        {t.is_default && <Badge variant="secondary" className="text-[10px]">หลัก</Badge>}
                        {!t.is_active && <Badge variant="outline" className="text-[10px]">ปิด</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Editor */}
        {draft ? (
          <Card>
            <CardHeader className="py-3 flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">{draft.name}</CardTitle>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <code>{draft.code}</code> · เวอร์ชัน {draft.version}
                  {errorCount > 0 ? (
                    <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{errorCount} error</Badge>
                  ) : warnCount > 0 ? (
                    <Badge variant="secondary" className="gap-1"><AlertTriangle className="w-3 h-3" />{warnCount} warning</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-green-700 border-green-300"><CheckCircle2 className="w-3 h-3" />ไม่มีปัญหา</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <BookTemplate className="w-4 h-4 mr-1" /> โหลดต้นแบบ
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-[60vh] overflow-auto">
                      <DropdownMenuLabel>ต้นแบบสำหรับ {draft.code}</DropdownMenuLabel>
                      {presetsForCode(draft.code).length === 0 && (
                        <DropdownMenuItem disabled>ไม่มีต้นแบบสำหรับรหัสนี้</DropdownMenuItem>
                      )}
                      {presetsForCode(draft.code).map((p) => (
                        <DropdownMenuItem key={p.key} onClick={() => loadPreset(p.key)}>{p.label}</DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>ต้นแบบทั้งหมด</DropdownMenuLabel>
                      {PRINT_PRESETS.map((p) => (
                        <DropdownMenuItem key={p.key} onClick={() => loadPreset(p.key)}>
                          <span className="text-[10px] text-muted-foreground mr-2">{p.code}</span>{p.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button variant="outline" size="sm" onClick={() => setFullscreen(true)}>
                  <Maximize2 className="w-4 h-4 mr-1" /> แก้ไขเต็มจอ
                </Button>
                <Button variant="outline" size="sm" onClick={testPrint}>
                  <Printer className="w-4 h-4 mr-1" /> ทดสอบพิมพ์
                </Button>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={duplicate}>
                    <Copy className="w-4 h-4 mr-1" /> คัดลอก
                  </Button>
                )}
                {canEdit && !draft.is_default && (
                  <Button variant="outline" size="sm" onClick={setDefault}>
                    ตั้งเป็นฟอร์มหลัก
                  </Button>
                )}
                {canEdit && (
                  <Button variant="destructive" size="sm" onClick={removeTemplate}>
                    <Trash2 className="w-4 h-4 mr-1" /> ลบ
                  </Button>
                )}
                {canEdit && (
                  <Button size="sm" onClick={save} disabled={errorCount > 0} title={errorCount > 0 ? "แก้ error ก่อนบันทึก" : ""}>
                    <Save className="w-4 h-4 mr-1" /> บันทึก
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Settings row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">ชื่อ</Label>
                  <Input value={draft.name} onChange={(e) => updateDraft("name", e.target.value)} disabled={!canEdit} />
                </div>
                <div>
                  <Label className="text-xs">รหัส (code)</Label>
                  <Input value={draft.code} onChange={(e) => updateDraft("code", e.target.value)} disabled={!canEdit} />
                </div>
                <div>
                  <Label className="text-xs">ขนาดกระดาษ</Label>
                  <Select value={draft.paper} onValueChange={(v) => updateDraft("paper", v)} disabled={!canEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="A5">A5</SelectItem>
                      <SelectItem value="A6">A6</SelectItem>
                      <SelectItem value="letter">Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">การวาง</Label>
                  <Select value={draft.orientation} onValueChange={(v) => updateDraft("orientation", v)} disabled={!canEdit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">แนวตั้ง</SelectItem>
                      <SelectItem value="landscape">แนวนอน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">บน (mm)</Label>
                  <Input type="number" value={draft.margin_top} onChange={(e) => updateDraft("margin_top", Number(e.target.value))} disabled={!canEdit} />
                </div>
                <div>
                  <Label className="text-xs">ขวา (mm)</Label>
                  <Input type="number" value={draft.margin_right} onChange={(e) => updateDraft("margin_right", Number(e.target.value))} disabled={!canEdit} />
                </div>
                <div>
                  <Label className="text-xs">ล่าง (mm)</Label>
                  <Input type="number" value={draft.margin_bottom} onChange={(e) => updateDraft("margin_bottom", Number(e.target.value))} disabled={!canEdit} />
                </div>
                <div>
                  <Label className="text-xs">ซ้าย (mm)</Label>
                  <Input type="number" value={draft.margin_left} onChange={(e) => updateDraft("margin_left", Number(e.target.value))} disabled={!canEdit} />
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch checked={draft.is_active} onCheckedChange={(v) => updateDraft("is_active", v)} disabled={!canEdit} />
                  <Label className="text-sm">เปิดใช้งาน</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={draft.is_default} onCheckedChange={(v) => updateDraft("is_default", v)} disabled={!canEdit} />
                  <Label className="text-sm">ใช้เป็นฟอร์มหลัก</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={!!draft.overlay_mode} onCheckedChange={(v) => updateDraft("overlay_mode" as any, v as any)} disabled={!canEdit} />
                  <Label className="text-sm">โหมด Overlay (วางทับฟอร์มต้นฉบับ)</Label>
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                  <Label className="text-xs whitespace-nowrap">URL พื้นหลัง</Label>
                  <Input
                    value={draft.background_url || ""}
                    onChange={(e) => updateDraft("background_url" as any, e.target.value as any)}
                    placeholder="https://… หรือ data: หรืออัปโหลด →"
                    disabled={!canEdit}
                  />
                  {canEdit && (
                    <label className="inline-flex items-center gap-1 cursor-pointer text-xs px-2 py-1 border rounded hover:bg-muted">
                      <Upload className="w-3 h-3" />
                      อัปโหลด
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadBg(e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Lint panel */}
              {issues.length > 0 && (
                <div className="border rounded-md p-2 bg-amber-50/40 text-xs space-y-1 max-h-32 overflow-auto">
                  {issues.map((i, idx) => (
                    <div key={idx} className={`flex items-start gap-2 ${i.level === "error" ? "text-destructive" : "text-amber-700"}`}>
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span><b>[{i.field || "-"}]</b> {i.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {draft.overlay_mode && (
                <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded flex items-center gap-2">
                  <Wand2 className="w-3 h-3" />
                  ใช้แท็บ <b>Designer</b> เพื่อวางฟิลด์บนพื้นหลังด้วยเมาส์ (ไม่ต้องเขียน HTML)
                </div>
              )}

              <Separator />

              {/* Token palette */}
              <div className="flex flex-wrap gap-1">
                <span className="text-xs text-muted-foreground self-center mr-1">แทรกตัวแปร:</span>
                {TOKEN_HINTS.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => insertToken(t)}
                    disabled={!canEdit}
                    title={t}
                  >
                    {tokenThaiLabel(t)}
                    <span className="ml-1 text-[10px] text-muted-foreground font-mono">{t}</span>
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Editor tabs */}
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="flex-wrap h-auto">
                    {draft.overlay_mode && <TabsTrigger value="designer"><Wand2 className="w-3 h-3 mr-1" />Designer</TabsTrigger>}
                    <TabsTrigger value="design">ออกแบบ (Word)</TabsTrigger>
                    <TabsTrigger value="header">Header</TabsTrigger>
                    <TabsTrigger value="body">Body (HTML)</TabsTrigger>
                    <TabsTrigger value="footer">Footer</TabsTrigger>
                    <TabsTrigger value="css">CSS</TabsTrigger>
                    <TabsTrigger value="data">Sample data</TabsTrigger>
                    <TabsTrigger value="versions"><History className="w-3 h-3 mr-1" />Versions</TabsTrigger>
                  </TabsList>
                  <TabsContent value="design">
                    <WordLikeEditor
                      content={draft.body_html || ""}
                      onChange={(html) => updateDraft("body_html", html)}
                      paper={(draft.paper as any) || "A4"}
                      orientation={(draft.orientation as any) || "portrait"}
                      margins={{ top: draft.margin_top, right: draft.margin_right, bottom: draft.margin_bottom, left: draft.margin_left }}
                      variableSuggestions={variableSuggestions}
                      disabled={!canEdit}
                    />
                  </TabsContent>
                  {draft.overlay_mode && (
                    <TabsContent value="designer">
                      <OverlayDesigner
                        backgroundUrl={draft.background_url || ""}
                        paper={(draft.paper as any) || "A4"}
                        orientation={(draft.orientation as any) || "portrait"}
                        bodyHtml={draft.body_html || ""}
                        variableSuggestions={variableSuggestions}
                        onChange={(html) => updateDraft("body_html", html)}
                      />
                    </TabsContent>
                  )}
                  <TabsContent value="header">
                    <Textarea
                      value={draft.header_html || ""}
                      onChange={(e) => updateDraft("header_html", e.target.value)}
                      className="font-mono text-xs h-[55vh]"
                      disabled={!canEdit}
                    />
                  </TabsContent>
                  <TabsContent value="body">
                    <Textarea
                      value={draft.body_html}
                      onChange={(e) => updateDraft("body_html", e.target.value)}
                      className="font-mono text-xs h-[55vh]"
                      disabled={!canEdit}
                    />
                  </TabsContent>
                  <TabsContent value="footer">
                    <Textarea
                      value={draft.footer_html || ""}
                      onChange={(e) => updateDraft("footer_html", e.target.value)}
                      className="font-mono text-xs h-[55vh]"
                      disabled={!canEdit}
                    />
                  </TabsContent>
                  <TabsContent value="css">
                    <Textarea
                      value={draft.css || ""}
                      onChange={(e) => updateDraft("css", e.target.value)}
                      className="font-mono text-xs h-[55vh]"
                      placeholder=".pt-body h1 { color: navy; }"
                      disabled={!canEdit}
                    />
                  </TabsContent>
                  <TabsContent value="data">
                    <Textarea
                      value={JSON.stringify(draft.sample_data, null, 2)}
                      onChange={(e) => {
                        try {
                          updateDraft("sample_data", JSON.parse(e.target.value));
                        } catch {
                          /* ignore invalid json mid-edit */
                        }
                      }}
                      className="font-mono text-xs h-[55vh]"
                      disabled={!canEdit}
                    />
                  </TabsContent>
                  <TabsContent value="versions">
                    <div className="border rounded-md max-h-[55vh] overflow-auto divide-y text-sm">
                      {versions.length === 0 && (
                        <div className="p-4 text-center text-muted-foreground text-xs">ยังไม่มีประวัติเวอร์ชัน</div>
                      )}
                      {versions.map((v: any) => (
                        <div key={v.id} className="p-2 flex items-center gap-2">
                          <Badge variant="outline">v{v.version}</Badge>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate">{v.changed_by || "ระบบ"}</div>
                            <div className="text-[10px] text-muted-foreground">{new Date(v.created_at).toLocaleString("th-TH")}</div>
                          </div>
                          {canEdit && (
                            <Button size="sm" variant="outline" onClick={() => restoreVersion(v)}>
                              <RotateCcw className="w-3 h-3 mr-1" /> กู้คืน
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Preview */}
                <div className="border rounded-lg overflow-hidden bg-white">
                  <div className="bg-muted px-3 py-1.5 text-xs flex items-center gap-2">
                    <Eye className="w-3 h-3" /> Live preview
                  </div>
                  <iframe
                    title="preview"
                    srcDoc={previewHtml}
                    sandbox=""
                    className="w-full h-[55vh] bg-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              เลือกฟอร์มจากรายการด้านซ้าย หรือกด "สร้างฟอร์มใหม่"
            </CardContent>
          </Card>
        )}
      </div>

      {/* Fullscreen editor — true fullscreen overlay */}
      {fullscreen && draft && (
        <div
          className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden overscroll-contain"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40">
            <div className="flex items-center gap-2 font-medium">
              <Maximize2 className="w-4 h-4" /> แก้ไขเต็มจอ — {draft.name}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowPreviewPane((v) => !v)}>
                <Eye className="w-4 h-4 mr-1" /> {showPreviewPane ? "ซ่อน Preview" : "แสดง Preview"}
              </Button>
              <Button size="sm" variant="outline" onClick={testPrint}><Printer className="w-4 h-4 mr-1" />ทดสอบพิมพ์</Button>
              {canEdit && (
                <Button size="sm" onClick={save} disabled={errorCount > 0}><Save className="w-4 h-4 mr-1" />บันทึก</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setFullscreen(false)}>
                <Minimize2 className="w-4 h-4 mr-1" /> ปิด
              </Button>
            </div>
          </div>
          <div className={`grid ${showPreviewPane ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"} gap-3 flex-1 min-h-0 overflow-hidden p-3`}>
            <Tabs value={tab} onValueChange={setTab} className="flex flex-col min-h-0">
              <TabsList className="flex-wrap h-auto self-start">
                {draft.overlay_mode && <TabsTrigger value="designer"><Wand2 className="w-3 h-3 mr-1" />Designer</TabsTrigger>}
                <TabsTrigger value="design">ออกแบบ (Word)</TabsTrigger>
                <TabsTrigger value="header">Header</TabsTrigger>
                <TabsTrigger value="body">Body (HTML)</TabsTrigger>
                <TabsTrigger value="footer">Footer</TabsTrigger>
                <TabsTrigger value="css">CSS</TabsTrigger>
                <TabsTrigger value="data">Sample data</TabsTrigger>
              </TabsList>
              <TabsContent value="design" className="flex-1 min-h-0 overflow-hidden">
                <WordLikeEditor
                  content={draft.body_html || ""}
                  onChange={(html) => updateDraft("body_html", html)}
                  paper={(draft.paper as any) || "A4"}
                  orientation={(draft.orientation as any) || "portrait"}
                  margins={{ top: draft.margin_top, right: draft.margin_right, bottom: draft.margin_bottom, left: draft.margin_left }}
                  variableSuggestions={variableSuggestions}
                  disabled={!canEdit}
                  fullHeight
                />
              </TabsContent>
              {draft.overlay_mode && (
                <TabsContent value="designer" className="flex-1 min-h-0 overflow-auto">
                  <OverlayDesigner
                    backgroundUrl={draft.background_url || ""}
                    paper={(draft.paper as any) || "A4"}
                    orientation={(draft.orientation as any) || "portrait"}
                    bodyHtml={draft.body_html || ""}
                    variableSuggestions={variableSuggestions}
                    onChange={(html) => updateDraft("body_html", html)}
                  />
                </TabsContent>
              )}
              <TabsContent value="header" className="flex-1 min-h-0">
                <Textarea value={draft.header_html || ""} onChange={(e) => updateDraft("header_html", e.target.value)} className="font-mono text-sm h-full w-full" disabled={!canEdit} />
              </TabsContent>
              <TabsContent value="body" className="flex-1 min-h-0">
                <Textarea value={draft.body_html} onChange={(e) => updateDraft("body_html", e.target.value)} className="font-mono text-sm h-full w-full" disabled={!canEdit} />
              </TabsContent>
              <TabsContent value="footer" className="flex-1 min-h-0">
                <Textarea value={draft.footer_html || ""} onChange={(e) => updateDraft("footer_html", e.target.value)} className="font-mono text-sm h-full w-full" disabled={!canEdit} />
              </TabsContent>
              <TabsContent value="css" className="flex-1 min-h-0">
                <Textarea value={draft.css || ""} onChange={(e) => updateDraft("css", e.target.value)} className="font-mono text-sm h-full w-full" disabled={!canEdit} />
              </TabsContent>
              <TabsContent value="data" className="flex-1 min-h-0">
                <Textarea
                  value={JSON.stringify(draft.sample_data, null, 2)}
                  onChange={(e) => { try { updateDraft("sample_data", JSON.parse(e.target.value)); } catch {} }}
                  className="font-mono text-sm h-full w-full"
                  disabled={!canEdit}
                />
              </TabsContent>
            </Tabs>
            {showPreviewPane && (
              <div className="border rounded-lg overflow-hidden bg-white flex flex-col min-h-0">
                <div className="bg-muted px-3 py-1.5 text-xs flex items-center gap-2 shrink-0"><Eye className="w-3 h-3" /> Live preview</div>
                <iframe title="preview-full" srcDoc={previewHtml} sandbox="" className="w-full flex-1 bg-white" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintTemplatesPage;
