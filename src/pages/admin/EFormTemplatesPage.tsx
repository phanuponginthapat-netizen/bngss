import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCmsValues } from "@/hooks/useCmsSettings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, FileText, Pencil, Trash2, Play, Loader2, Sparkles, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import EFormTemplateDesigner from "@/components/eform/EFormTemplateDesigner";
import { EFormFillDialog } from "@/components/eform/EFormFillDialog";
import { EFormPresetPicker } from "@/components/eform/EFormPresetPicker";
import { EFormPdfDesigner } from "@/components/eform/EFormPdfDesigner";
import type { EFormField, EFormTemplateRow, EFormRenderContext } from "@/lib/eformTemplate";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { FullscreenShell } from "@/components/ui/FullscreenShell";
import { applyCurrentOfficialPreset, type EFormPreset } from "@/lib/eformPresets";
import type { PdfOverlayField } from "@/lib/eformPdf";
import EFormTemplateThumbnail from "@/components/eform/EFormTemplateThumbnail";

const EMPTY_HTML = `<h2 style="text-align:center;">หัวข้อเอกสาร</h2><p>เนื้อหา ...</p>`;

const EFormTemplatesPage = () => {
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<EFormTemplateRow | null>(null);
  const [draftMode, setDraftMode] = useState<"html" | "pdf">("html");
  const [draftHtml, setDraftHtml] = useState("");
  const [draftFields, setDraftFields] = useState<EFormField[]>([]);
  const [draftPdfPath, setDraftPdfPath] = useState<string>("");
  const [draftOverlays, setDraftOverlays] = useState<PdfOverlayField[]>([]);
  const [draftMeta, setDraftMeta] = useState({ name: "", description: "", category: "custom", page_size: "A4", font_family: "TH Sarabun New", font_size_pt: 16, is_active: true });
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  useBodyScrollLock(fullscreen);

  const [fillTemplate, setFillTemplate] = useState<EFormTemplateRow | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["eform_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eform_templates" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as unknown as EFormTemplateRow[]).map(applyCurrentOfficialPreset);
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("eform_templates_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "eform_templates" }, () => {
        qc.invalidateQueries({ queryKey: ["eform_templates"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  // Context for fill preview (CMS values) — via bulk cache
  const cms = useCmsValues([
    "school_name", "school_address", "school_phone",
    "director_name", "director_title",
    "garuda_emblem", "school_seal", "school_logo",
  ]);


  const { data: myProfile } = useQuery({
    queryKey: ["my_profile_for_eform"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("first_name, last_name, position").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const fillContext: EFormRenderContext = useMemo(() => ({
    user: {
      name: myProfile ? `${(myProfile as any).first_name || ""} ${(myProfile as any).last_name || ""}`.trim() : "",
      position: (myProfile as any)?.position || "",
    },
    school: {
      name: (cms as any).school_name || "",
      address: (cms as any).school_address || "",
      phone: (cms as any).school_phone || "",
    },
    director: {
      name: (cms as any).director_name || "",
      title: (cms as any).director_title || "ผู้อำนวยการโรงเรียน",
    },
    assets: {
      garuda_emblem: (cms as any).garuda_emblem || "",
      school_seal: (cms as any).school_seal || "",
      school_logo: (cms as any).school_logo || "",
    },
  }), [cms, myProfile]);

  const openCreate = () => {
    setPickerOpen(true);
  };

  const startBlank = () => {
    setEditing(null);
    setDraftMode("html");
    setDraftHtml(EMPTY_HTML);
    setDraftFields([]);
    setDraftPdfPath("");
    setDraftOverlays([]);
    setDraftMeta({ name: "", description: "", category: "custom", page_size: "A4", font_family: "TH Sarabun New", font_size_pt: 16, is_active: true });
    setPickerOpen(false);
    setEditorOpen(true);
  };

  const startPdf = () => {
    setEditing(null);
    setDraftMode("pdf");
    setDraftHtml("");
    setDraftFields([]);
    setDraftPdfPath("");
    setDraftOverlays([]);
    setDraftMeta({ name: "ฟอร์ม PDF ใหม่", description: "", category: "official", page_size: "A4", font_family: "TH Sarabun New", font_size_pt: 14, is_active: true });
    setPickerOpen(false);
    setEditorOpen(true);
  };

  const startFromPreset = (p: EFormPreset) => {
    setEditing(null);
    setDraftMode("html");
    setDraftHtml(p.content_html);
    setDraftFields(p.fields);
    setDraftPdfPath("");
    setDraftOverlays([]);
    setDraftMeta({
      name: p.name,
      description: p.description,
      category: p.category,
      page_size: p.page_size,
      font_family: p.font_family,
      font_size_pt: p.font_size_pt,
      is_active: true,
    });
    setPickerOpen(false);
    setEditorOpen(true);
  };

  const openEdit = (t: EFormTemplateRow) => {
    setEditing(t);
    setDraftMode((t.template_mode as "html" | "pdf") || "html");
    setDraftHtml(t.content_html || EMPTY_HTML);
    setDraftFields(t.fields || []);
    setDraftPdfPath(t.pdf_url || "");
    setDraftOverlays((t.pdf_overlay_fields || []) as PdfOverlayField[]);
    setDraftMeta({
      name: t.name, description: t.description || "", category: t.category || "custom",
      page_size: t.page_size, font_family: t.font_family, font_size_pt: t.font_size_pt, is_active: t.is_active,
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!draftMeta.name.trim()) { toast.error("กรอกชื่อต้นแบบก่อน"); return; }
    if (draftMode === "pdf" && !draftPdfPath) { toast.error("อัพโหลด PDF ก่อน"); return; }
    setSaving(true);
    try {
      const payload: any = {
        ...draftMeta,
        template_mode: draftMode,
        content_html: draftMode === "html" ? draftHtml : "",
        fields: draftMode === "html" ? draftFields : [],
        pdf_url: draftMode === "pdf" ? draftPdfPath : null,
        pdf_overlay_fields: draftMode === "pdf" ? draftOverlays : [],
      };
      if (editing) {
        const { error } = await supabase.from("eform_templates" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("บันทึกต้นแบบแล้ว");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        payload.created_by = user?.id;
        const { error } = await supabase.from("eform_templates" as any).insert(payload);
        if (error) throw error;
        toast.success("สร้างต้นแบบใหม่แล้ว");
      }
      setEditorOpen(false);
      qc.invalidateQueries({ queryKey: ["eform_templates"] });
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("ลบต้นแบบนี้?")) return;
    const { error } = await supabase.from("eform_templates" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบแล้ว");
    qc.invalidateQueries({ queryKey: ["eform_templates"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> ต้นแบบ E-Form
          </h1>
          <p className="text-sm text-muted-foreground">ออกแบบฟอร์มเอกสารด้วย rich-text editor — แก้ฟอนต์ บรรทัด แทรกช่องกรอกได้เอง โดยไม่ต้องแก้โค้ดในระบบ</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> สร้างต้นแบบใหม่</Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground p-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด...</div>
      ) : templates.length === 0 ? (
        <Card><CardContent className="p-12 text-center space-y-2">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">ยังไม่มีต้นแบบ — กด "สร้างต้นแบบใหม่" เพื่อเริ่ม</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-shadow overflow-hidden">
              <div className="bg-muted/30 p-3 flex justify-center">
                {t.template_mode === "pdf" ? (
                  <div className="w-[280px] h-[360px] rounded-md border bg-white flex items-center justify-center text-xs text-muted-foreground">
                    PDF Overlay Template
                  </div>
                ) : (
                  <EFormTemplateThumbnail template={t} context={fillContext} />
                )}
              </div>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold truncate">{t.name}</h3>
                    {t.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>}
                  </div>
                  {!t.is_active && <Badge variant="secondary" className="text-[10px]">ปิด</Badge>}
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <Badge variant="outline">{t.page_size}</Badge>
                  <Badge variant="outline">{t.font_size_pt}px</Badge>
                  <Badge variant="outline">{(t.fields?.length || 0)} ช่อง</Badge>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <Button size="sm" className="flex-1 h-8" onClick={() => setFillTemplate(t)}><Play className="w-3.5 h-3.5 mr-1" /> ใช้งาน</Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Designer */}
      {(() => {
        if (!editorOpen) return null;
        const body = (
          <>
            <div className="flex items-center justify-between gap-2 shrink-0">
              <h2 className="text-lg font-semibold">{editing ? "แก้ไขต้นแบบ" : "สร้างต้นแบบใหม่"}</h2>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setFullscreen(f => !f)} title={fullscreen ? "ออกจากเต็มจอ" : "เต็มจอ"}>
                  {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  <span className="ml-1 text-xs">{fullscreen ? "ย่อ" : "เต็มจอ"}</span>
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditorOpen(false); setFullscreen(false); }}>ปิด</Button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              {draftMode === "pdf" ? (
                <EFormPdfDesigner
                  pdfPath={draftPdfPath}
                  overlays={draftOverlays}
                  onChange={(path, overlays) => { setDraftPdfPath(path); setDraftOverlays(overlays); }}
                />
              ) : (
                <EFormTemplateDesigner
                  initialHtml={draftHtml}
                  initialFields={draftFields}
                  onChange={(html, fields) => { setDraftHtml(html); setDraftFields(fields); }}
                  headerExtra={
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">ชื่อต้นแบบ *</Label>
                        <Input value={draftMeta.name} onChange={(e) => setDraftMeta(m => ({ ...m, name: e.target.value }))} placeholder="เช่น แบบฟอร์มขออนุญาต..." className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">หมวด</Label>
                        <Select value={draftMeta.category} onValueChange={(v) => setDraftMeta(m => ({ ...m, category: v }))}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="custom">ทั่วไป</SelectItem>
                            <SelectItem value="official">ราชการ</SelectItem>
                            <SelectItem value="personnel">บุคลากร</SelectItem>
                            <SelectItem value="student">นักเรียน</SelectItem>
                            <SelectItem value="budget">งบประมาณ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">คำอธิบาย</Label>
                        <Textarea value={draftMeta.description} onChange={(e) => setDraftMeta(m => ({ ...m, description: e.target.value }))} rows={2} className="text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="active" checked={draftMeta.is_active} onCheckedChange={(c) => setDraftMeta(m => ({ ...m, is_active: c }))} />
                        <Label htmlFor="active" className="text-xs">เปิดใช้งาน</Label>
                      </div>
                    </div>
                  }
                />
              )}
            </div>

            <div className="flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => { setEditorOpen(false); setFullscreen(false); }}>ยกเลิก</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-1" />} บันทึกต้นแบบ
              </Button>
            </div>
          </>
        );

        if (fullscreen) {
          return (
            <div className="fixed inset-0 z-40 bg-background p-4 flex flex-col gap-3 overflow-hidden">
              {body}
            </div>
          );
        }
        return (
          <Dialog open={editorOpen} onOpenChange={(o) => { setEditorOpen(o); if (!o) setFullscreen(false); }}>
            <DialogContent className="sm:max-w-[95vw] sm:w-[95vw] sm:max-h-[95vh] flex flex-col gap-3 p-4">
              {body}
            </DialogContent>
          </Dialog>
        );
      })()}


      {/* Fill */}
      <EFormFillDialog
        open={!!fillTemplate}
        onOpenChange={(o) => !o && setFillTemplate(null)}
        template={fillTemplate}
        context={fillContext}
      />

      {/* Preset picker */}
      <EFormPresetPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPickBlank={startBlank}
        onPickPreset={startFromPreset}
        onPickPdf={startPdf}
        onPickWordHtml={(html, fileName) => {
          setEditing(null);
          setDraftMode("html");
          setDraftHtml(html);
          setDraftFields([]);
          setDraftPdfPath("");
          setDraftOverlays([]);
          setDraftMeta({ name: fileName || "นำเข้าจาก Word", description: "นำเข้าจากไฟล์ Word", category: "custom", page_size: "A4", font_family: "TH Sarabun New", font_size_pt: 16, is_active: true });
          setPickerOpen(false);
          setEditorOpen(true);
        }}
      />
    </div>
  );
};

export default EFormTemplatesPage;
