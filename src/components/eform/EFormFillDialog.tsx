import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, Send, RotateCcw, PenLine, Maximize2, Minimize2, Save } from "lucide-react";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import { openPrintWindow } from "@/lib/printUtils";
import { renderEFormTemplate, type EFormTemplateRow, type EFormRenderContext } from "@/lib/eformTemplate";
import { EFORM_PAGE_STYLE, wrapEFormPrintHtml } from "@/lib/eformLayout";
import { replaceSchoolAssetTokens } from "@/lib/eformSchoolAssets";
import type { PdfOverlayField } from "@/lib/eformPdf";
import { EFormPdfFill } from "@/components/eform/EFormPdfFill";
import { SendEFormDialog } from "@/components/eform/SendEFormDialog";
import EFormRichEditor from "@/components/eform/EFormRichEditor";
import EFormPageCanvas, { PX_PER_MM } from "@/components/eform/EFormPageCanvas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: EFormTemplateRow | null;
  context: EFormRenderContext;
}

// Mini signature pad
const SignaturePad = ({ value, onChange }: { value?: string; onChange: (dataUrl: string) => void }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    if (value?.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = value;
    }
  }, [value]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height };
  };

  return (
    <div className="space-y-1.5">
      <canvas
        ref={ref}
        width={400}
        height={120}
        className="w-full border rounded bg-white touch-none cursor-crosshair"
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = ref.current!.getContext("2d")!;
          const p = pos(e);
          ctx.beginPath(); ctx.moveTo(p.x, p.y);
          ctx.lineWidth = 2; ctx.strokeStyle = "#111"; ctx.lineCap = "round";
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = ref.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y); ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          onChange(ref.current!.toDataURL("image/png"));
        }}
      />
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
        const ctx = ref.current!.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, ref.current!.width, ref.current!.height);
        onChange("");
      }}>
        <RotateCcw className="w-3 h-3 mr-1" /> ล้าง
      </Button>
    </div>
  );
};

const PAGE_MARGINS = { top: 25, right: 20, bottom: 20, left: 30 };
const A4_PAGE_H_PX = 297 * PX_PER_MM;
const A4_CONTENT_H_PX = (297 - PAGE_MARGINS.top - PAGE_MARGINS.bottom) * PX_PER_MM;

const PagedEFormPreview = ({
  html,
  fontFamily,
  fontSizePt,
  editable = false,
  onChange,
}: {
  html: string;
  fontFamily: string;
  fontSizePt: number;
  editable?: boolean;
  onChange?: (html: string) => void;
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLStyleElement>(null);
  const scopeClassRef = useRef(`eform-fill-paged-${Math.random().toString(36).slice(2)}`);
  const lastHtmlRef = useRef(html);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    if (!editable) return;
    const el = contentRef.current;
    if (!el) return;
    if (el.innerHTML !== html) el.innerHTML = html;
    lastHtmlRef.current = html;
  }, [editable, html]);

  useEffect(() => {
    const el = contentRef.current;
    const styleEl = styleRef.current;
    if (!el || !styleEl) return;
    const scopeClass = scopeClassRef.current;
    el.classList.add(scopeClass);
    el.style.minHeight = `${A4_CONTENT_H_PX}px`;

    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.classList.remove(scopeClass);
        clone.style.cssText = el.style.cssText;
        clone.style.position = "fixed";
        clone.style.left = "-10000px";
        clone.style.top = "0";
        clone.style.width = `${el.offsetWidth}px`;
        clone.style.height = "auto";
        clone.style.visibility = "hidden";
        clone.style.pointerEvents = "none";
        document.body.appendChild(clone);

        const rules: string[] = [];
        const children = Array.from(clone.children) as HTMLElement[];
        let accumulatedGap = 0;
        let measuredBottom = Math.max(0, clone.scrollHeight);
        const EPS = 2;

        children.forEach((child, index) => {
          const height = child.offsetHeight;
          if (!height) return;
          let top = child.offsetTop + accumulatedGap;
          const pageIndex = Math.max(0, Math.floor((top + EPS) / A4_PAGE_H_PX));
          const pageTop = pageIndex * A4_PAGE_H_PX;
          const printableBottom = pageTop + A4_CONTENT_H_PX;
          const nextPrintableTop = (pageIndex + 1) * A4_PAGE_H_PX;
          const startsAtPrintableTop = Math.abs(top - pageTop) <= EPS;
          let gap = 0;
          if (top >= printableBottom - EPS && top < nextPrintableTop - EPS) gap = nextPrintableTop - top;
          else if (top + height > printableBottom + EPS && !startsAtPrintableTop) gap = nextPrintableTop - top;
          if (gap > EPS) {
            const roundedGap = Math.ceil(gap);
            rules.push(`.${scopeClass} > :nth-child(${index + 1}) { margin-top: ${roundedGap}px !important; }`);
            accumulatedGap += roundedGap;
            top += roundedGap;
          }
          measuredBottom = Math.max(measuredBottom, top + height, clone.scrollHeight + accumulatedGap);
        });

        clone.remove();
        setPages(Math.max(1, Math.floor(Math.max(0, measuredBottom - EPS) / A4_PAGE_H_PX) + 1));
        const nextCss = rules.join("\n");
        if (styleEl.textContent !== nextCss) styleEl.textContent = nextCss;
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("input", measure);
    const images = Array.from(el.querySelectorAll("img"));
    images.forEach((img) => img.addEventListener("load", measure));
    document.fonts?.ready?.then(measure).catch(() => undefined);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("input", measure);
      images.forEach((img) => img.removeEventListener("load", measure));
      el.classList.remove(scopeClass);
      styleEl.textContent = "";
    };
  }, [html, fontFamily, fontSizePt, editable]);

  return (
    <EFormPageCanvas
      pages={pages}
      margins={PAGE_MARGINS}
      paperWidthMm={210}
      paperHeightMm={297}
      className="bg-slate-100 px-4 pt-4 pb-8 overflow-auto h-full flex justify-center"
      pageStyle={{ ...(EFORM_PAGE_STYLE as any), padding: `${PAGE_MARGINS.top}mm ${PAGE_MARGINS.right}mm ${PAGE_MARGINS.bottom}mm ${PAGE_MARGINS.left}mm` }}
    >
      <style ref={styleRef} />
      <div
        ref={contentRef}
        className={`eform-preview-page max-w-none bg-white text-black focus:outline-none ${editable ? "cursor-text" : ""}`}
        style={{ fontFamily: `'${fontFamily}', Sarabun, sans-serif`, fontSize: `${Math.round((fontSizePt || 16) * 4 / 3)}px`, lineHeight: 1.5 }}
        contentEditable={editable}
        suppressContentEditableWarning={editable}
        spellCheck={false}
        onInput={(event) => {
          if (!editable) return;
          const next = event.currentTarget.innerHTML;
          lastHtmlRef.current = next;
          onChange?.(next);
        }}
        dangerouslySetInnerHTML={editable ? undefined : { __html: html }}
      />
    </EFormPageCanvas>
  );
};

export const EFormFillDialog = ({ open, onOpenChange, template, context }: Props) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [sendOpen, setSendOpen] = useState(false);
  const [editedHtml, setEditedHtml] = useState<string>("");
  const [fullscreen, setFullscreen] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [richEditor, setRichEditor] = useState<any>(null);

  const isPdfMode = template?.template_mode === "pdf" && !!template?.pdf_url;
  const pdfOverlays = (template?.pdf_overlay_fields || []) as PdfOverlayField[];

  // Build fields list for the input panel (from HTML fields OR PDF overlays)
  const inputFields = useMemo(() => {
    if (!template) return [] as any[];
    if (isPdfMode) {
      return pdfOverlays.map(o => ({
        key: o.key,
        label: o.label,
        type: o.type as any,
        required: o.required,
        autofillSource: o.autofillSource as any,
        options: o.options,
        defaultValue: o.defaultValue,
      }));
    }
    return template.fields;
  }, [template, isPdfMode, pdfOverlays]);

  const noFields = !isPdfMode && inputFields.length === 0;

  // Prefill autofill + defaults whenever template changes
  useEffect(() => {
    if (!template) return;
    const init: Record<string, string> = {};
    inputFields.forEach((f: any) => {
      if (f.defaultValue) init[f.key] = f.defaultValue;
    });
    try {
      const savedVals = localStorage.getItem(`eform_draft_values:${template.id}`);
      if (savedVals) Object.assign(init, JSON.parse(savedVals));
    } catch {}
    setValues(init);
    const savedHtml = (() => {
      try { return localStorage.getItem(`eform_draft_html:${template.id}`) || ""; } catch { return ""; }
    })();
    setEditedHtml(savedHtml || template.content_html || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

  const saveDraft = () => {
    if (!template) return;
    try {
      localStorage.setItem(`eform_draft_values:${template.id}`, JSON.stringify(values));
      const html = noFields ? (previewRef.current?.innerHTML || editedHtml) : "";
      if (noFields) localStorage.setItem(`eform_draft_html:${template.id}`, html);
      toast.success("บันทึกฉบับร่างแล้ว");
    } catch {
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  const exec = (cmd: string, val?: string) => {
    previewRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (noFields && previewRef.current) setEditedHtml(previewRef.current.innerHTML);
  };

  const renderedHtml = useMemo(() => {
    if (!template || isPdfMode) return "";
    if (noFields) return editedHtml;
    return renderEFormTemplate(template.content_html, template.fields, values, context, { placeholderOnEmpty: true });
  }, [template, values, context, isPdfMode, noFields, editedHtml]);

  const safeHtml = useMemo(
    () => DOMPurify.sanitize(replaceSchoolAssetTokens(renderedHtml, context.assets), { ADD_ATTR: ["target", "data-eform-field", "style", "contenteditable"], ADD_TAGS: ["img"] }),
    [renderedHtml, context.assets],
  );

  if (!template) return null;

  const setValue = (key: string, value: string) => setValues(prev => ({ ...prev, [key]: value }));

  const handlePrint = () => {
    if (isPdfMode) {
      window.print();
      return;
    }
    const finalHtml = (noFields || editMode)
      ? editedHtml
      : renderEFormTemplate(template.content_html, template.fields, values, context);
    openPrintWindow(
      wrapEFormPrintHtml(finalHtml, `font-family:'${template.font_family}',Sarabun,sans-serif;font-size:${Math.round((template.font_size_pt || 16) * 4 / 3)}px;line-height:1.5;`, context.assets),
      { title: template.name },
    );
  };

  const cleanHtmlForSend = isPdfMode
    ? `<p>เอกสาร PDF ต้นแบบ <b>${template.name}</b> (ดูที่ไฟล์แนบ/หน้าจอ)</p>`
    : (noFields || editMode)
      ? editedHtml
      : renderEFormTemplate(template.content_html, template.fields, values, context);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={
            fullscreen
              ? "max-w-[100vw] w-screen h-screen max-h-screen rounded-none flex flex-col gap-3 p-4 sm:!max-w-none sm:!w-screen sm:!h-screen sm:!max-h-screen sm:!left-0 sm:!top-0 sm:!translate-x-0 sm:!translate-y-0 sm:!rounded-none"
              : "max-w-6xl max-h-[92vh] flex flex-col gap-3 p-4 sm:!max-w-6xl"
          }
        >
          <DialogHeader>
            <div className="flex items-start justify-between gap-2 pr-8">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  {template.name}
                  <Badge variant="outline" className="text-[10px]">ต้นแบบ</Badge>
                </DialogTitle>
                {template.description && <p className="text-xs text-muted-foreground">{template.description}</p>}
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                
                {!isPdfMode && !noFields && (
                  <Button size="sm" variant={editMode ? "default" : "outline"} onClick={() => {
                    if (!editMode) setEditedHtml(safeHtml);
                    setEditMode(m => !m);
                  }} className="h-8">
                    <PenLine className="w-4 h-4 mr-1" /> {editMode ? "โหมดดู" : "แก้ไขเอกสาร"}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={saveDraft} className="h-8"><Save className="w-4 h-4 mr-1" /> บันทึกร่าง</Button>
                <Button size="sm" variant="outline" onClick={handlePrint} className="h-8"><Printer className="w-4 h-4 mr-1" /> พิมพ์ / PDF</Button>
                <Button size="sm" onClick={() => setSendOpen(true)} className="h-8"><Send className="w-4 h-4 mr-1" /> ส่ง E-Form</Button>
                <Button size="sm" variant="outline" onClick={() => setFullscreen(f => !f)} className="h-8">
                  {fullscreen ? <><Minimize2 className="w-4 h-4 mr-1" /> ย่อ</> : <><Maximize2 className="w-4 h-4 mr-1" /> เต็มจอ</>}
                </Button>
              </div>
            </div>
          </DialogHeader>


          <div className={`grid grid-cols-1 ${inputFields.length === 0 && !isPdfMode ? "lg:grid-cols-1" : "lg:grid-cols-[320px_1fr]"} gap-4 flex-1 min-h-0 overflow-hidden`}>
            {/* Fields panel */}
            {(inputFields.length > 0 || isPdfMode) && (
            <Card className="overflow-hidden flex flex-col">
              <CardContent className="p-3 space-y-3 overflow-auto">
                {inputFields.map((f: any) => {
                  if (f.type === "autofill") {
                    return (
                      <div key={f.key}>
                        <Label className="text-xs">{f.label}</Label>
                        <Input value={f.autofillSource ? `[auto] ${f.autofillSource}` : ""} disabled className="h-8 text-sm" />
                      </div>
                    );
                  }
                  return (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        {f.label}
                        {f.required && <span className="text-destructive">*</span>}
                      </Label>
                      {f.type === "textarea" ? (
                        <Textarea value={values[f.key] || ""} onChange={(e) => setValue(f.key, e.target.value)} placeholder={f.placeholder} rows={3} className="text-sm" />
                      ) : f.type === "date" ? (
                        <Input type="date" value={values[f.key] || ""} onChange={(e) => setValue(f.key, e.target.value)} className="h-8 text-sm" />
                      ) : f.type === "number" ? (
                        <Input type="number" value={values[f.key] || ""} onChange={(e) => setValue(f.key, e.target.value)} placeholder={f.placeholder} className="h-8 text-sm" />
                      ) : f.type === "select" ? (
                        <Select value={values[f.key] || ""} onValueChange={(v) => setValue(f.key, v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="เลือก" /></SelectTrigger>
                          <SelectContent>
                            {(f.options || [])
                              .map((o: string) => String(o || "").trim())
                              .filter(Boolean)
                              .map((o: string, optionIndex: number) => <SelectItem key={`${o}-${optionIndex}`} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : f.type === "radio" ? (
                        <RadioGroup value={values[f.key] || ""} onValueChange={(v) => setValue(f.key, v)} className="flex flex-wrap gap-3 pt-1">
                          {(f.options || []).map((o: string) => (
                            <div key={o} className="flex items-center gap-1.5">
                              <RadioGroupItem value={o} id={`${f.key}_${o}`} />
                              <Label htmlFor={`${f.key}_${o}`} className="text-xs cursor-pointer">{o}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      ) : f.type === "checkbox" ? (
                        <div className="flex items-center gap-2 pt-1">
                          <Checkbox
                            id={f.key}
                            checked={values[f.key] === "true"}
                            onCheckedChange={(c) => setValue(f.key, c ? "true" : "false")}
                          />
                          <Label htmlFor={f.key} className="text-xs cursor-pointer">เลือก / ติ๊ก</Label>
                        </div>
                      ) : f.type === "signature" ? (
                        <SignaturePad value={values[f.key]} onChange={(v) => setValue(f.key, v)} />
                      ) : (
                        <Input value={values[f.key] || ""} onChange={(e) => setValue(f.key, e.target.value)} placeholder={f.placeholder} className="h-8 text-sm" />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            )}

            {/* Live preview / Rich editor when no fields */}
            <Card className="overflow-hidden flex flex-col">
              <CardContent className="p-0 flex-1 overflow-auto bg-slate-100">
                {isPdfMode ? (
                  <div className="p-4">
                    <EFormPdfFill
                      pdfPath={template.pdf_url!}
                      overlays={pdfOverlays}
                      values={values}
                      context={context}
                    />
                  </div>
                ) : noFields ? (
                  <EFormRichEditor
                    key={template.id + ":free-edit"}
                    html={editedHtml}
                    onChange={setEditedHtml}
                    fontFamily={template.font_family}
                    fontSizePt={template.font_size_pt}
                    onEditorReady={setRichEditor}
                  />
                ) : editMode ? (
                  <EFormRichEditor
                    key={template.id + ":inline-edit"}
                    html={editedHtml || safeHtml}
                    onChange={setEditedHtml}
                    fontFamily={template.font_family}
                    fontSizePt={template.font_size_pt}
                    onEditorReady={setRichEditor}
                  />

                ) : (
                  <EFormRichEditor
                    key={template.id + ":readonly"}
                    html={safeHtml}
                    onChange={() => undefined}
                    fontFamily={template.font_family}
                    fontSizePt={template.font_size_pt}
                    readOnly
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <SendEFormDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        title={template.name}
        contentHtml={wrapEFormPrintHtml(cleanHtmlForSend, `font-family:'${template.font_family}',Sarabun,sans-serif;font-size:${Math.round((template.font_size_pt || 16) * 4 / 3)}px;line-height:1.5;`, context.assets)}
        templateId={`custom:${template.id}`}
        category={template.category || "custom"}
        formData={values}
        urgency={values.urgency}
      />
    </>
  );
};

export default EFormFillDialog;
