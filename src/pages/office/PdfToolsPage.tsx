import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, Download, Type, Signature, Trash2, RotateCw, Merge, Highlighter, Printer, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { downloadFile, getFileMeta, MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { swal } from "@/lib/swal";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Annotation {
  id: string;
  page: number;
  x: number; y: number;
  type: "text" | "signature" | "highlight";
  text?: string;
  fontSize?: number;
  color?: string;
  imgDataUrl?: string;
  w?: number; h?: number;
}
const uid = () => Math.random().toString(36).slice(2, 9);

export default function PdfToolsPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState("เอกสาร.pdf");
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageIdx, setPageIdx] = useState(0);
  const [annots, setAnnots] = useState<Annotation[]>([]);
  const [tool, setTool] = useState<"none" | "text" | "signature" | "highlight">("none");
  const [textDraft, setTextDraft] = useState("");
  const [textColor, setTextColor] = useState("#111111");
  const [textSize, setTextSize] = useState(16);
  const [hlColor, setHlColor] = useState("#fef08a");
  const [sigDraft, setSigDraft] = useState<string | null>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [rotations, setRotations] = useState<Record<number, number>>({});
  const [scale, setScale] = useState(1);
  const [dragAnnot, setDragAnnot] = useState<string | null>(null);

  useEffect(() => {
    if (!fileIdParam) return;
    (async () => {
      try {
        const meta = await getFileMeta(fileIdParam);
        setFileName(meta.name);
        const buf = await downloadFile(fileIdParam);
        setPdfBytes(new Uint8Array(buf));
      } catch (e: any) { swal.error("เปิดไฟล์ไม่สำเร็จ", String(e?.message ?? e)); }
    })();
  }, [fileIdParam]);

  const handleUpload = async (file: File) => {
    const buf = await file.arrayBuffer();
    setPdfBytes(new Uint8Array(buf));
    setFileName(file.name); setFileId(null); setAnnots([]); setPageIdx(0);
  };

  const handleMerge = async (files: FileList) => {
    try {
      const merged = await PDFDocument.create();
      if (pdfBytes) {
        const cur = await PDFDocument.load(pdfBytes);
        const copied = await merged.copyPages(cur, cur.getPageIndices());
        copied.forEach(p => merged.addPage(p));
      }
      for (const f of Array.from(files)) {
        const doc = await PDFDocument.load(await f.arrayBuffer());
        const copied = await merged.copyPages(doc, doc.getPageIndices());
        copied.forEach(p => merged.addPage(p));
      }
      setPdfBytes(await merged.save()); setAnnots([]); setPageIdx(0);
      swal.toast.success("รวมไฟล์แล้ว");
    } catch (e: any) { swal.error("รวมไฟล์ไม่สำเร็จ", String(e?.message ?? e)); }
  };

  const extractPage = async () => {
    if (!pdfBytes) return;
    try {
      const src = await PDFDocument.load(pdfBytes);
      const out = await PDFDocument.create();
      const [p] = await out.copyPages(src, [pageIdx]);
      out.addPage(p);
      const bytes = await out.save();
      const blob = new Blob([bytes as BlobPart], { type: MIME.pdf });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `${fileName.replace(/\.pdf$/i, "")}-หน้า${pageIdx + 1}.pdf`; a.click();
    } catch (e: any) { swal.error("ดึงหน้าไม่สำเร็จ", String(e?.message ?? e)); }
  };

  const deletePage = async () => {
    if (!pdfBytes || numPages <= 1) return;
    if (!(await swal.confirm("ลบหน้านี้?", `หน้า ${pageIdx + 1}`))) return;
    const src = await PDFDocument.load(pdfBytes);
    src.removePage(pageIdx);
    setPdfBytes(await src.save());
    setAnnots(a => a.filter(x => x.page !== pageIdx).map(x => x.page > pageIdx ? { ...x, page: x.page - 1 } : x));
    setPageIdx(i => Math.max(0, i - 1));
  };

  const handlePageClick = (e: React.MouseEvent) => {
    if (tool === "none" || !pageWrapRef.current || dragAnnot) return;
    const rect = pageWrapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (tool === "text") {
      if (!textDraft.trim()) { swal.warning("พิมพ์ข้อความก่อน"); return; }
      setAnnots(a => [...a, { id: uid(), page: pageIdx, x, y, type: "text", text: textDraft, fontSize: textSize, color: textColor }]);
    } else if (tool === "signature") {
      if (!sigDraft) { swal.warning("วาดลายเซ็นก่อน"); return; }
      setAnnots(a => [...a, { id: uid(), page: pageIdx, x, y, type: "signature", imgDataUrl: sigDraft, w: 0.2, h: 0.08 }]);
    } else if (tool === "highlight") {
      setAnnots(a => [...a, { id: uid(), page: pageIdx, x, y, type: "highlight", color: hlColor, w: 0.2, h: 0.03 }]);
    }
  };

  const startDragAnnot = (e: React.PointerEvent, id: string) => {
    e.stopPropagation(); setDragAnnot(id);
    const a = annots.find(x => x.id === id); if (!a || !pageWrapRef.current) return;
    const rect = pageWrapRef.current.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const { x, y } = a;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;
      setAnnots(list => list.map(v => v.id === id ? { ...v, x: Math.max(0, Math.min(1, x + dx)), y: Math.max(0, Math.min(1, y + dy)) } : v));
    };
    const up = () => { setDragAnnot(null); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  const rotatePage = () => setRotations(r => ({ ...r, [pageIdx]: ((r[pageIdx] ?? 0) + 90) % 360 }));

  const sigStart = (e: React.MouseEvent | React.TouchEvent) => {
    drawing.current = true;
    const ctx = sigCanvasRef.current?.getContext("2d"); if (!ctx) return;
    ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y);
  };
  const sigMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const ctx = sigCanvasRef.current?.getContext("2d"); if (!ctx) return;
    const p = getPos(e); ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke();
  };
  const sigEnd = () => { drawing.current = false; };
  const sigClear = () => sigCanvasRef.current?.getContext("2d")?.clearRect(0, 0, 400, 150);
  const sigSave = () => { setSigDraft(sigCanvasRef.current?.toDataURL("image/png") ?? null); swal.toast.success("บันทึกลายเซ็นแล้ว"); };

  const buildPdf = async (): Promise<Blob> => {
    if (!pdfBytes) throw new Error("ไม่มีไฟล์");
    const doc = await PDFDocument.load(pdfBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const [idxStr, deg] of Object.entries(rotations)) {
      const p = doc.getPage(Number(idxStr));
      const cur = p.getRotation().angle;
      p.setRotation(degrees((cur + deg) % 360));
    }
    for (const a of annots) {
      const page = doc.getPage(a.page);
      const { width, height } = page.getSize();
      const px = a.x * width, py = height - a.y * height;
      const col = a.color ? hexToRgb(a.color) : { r: 0, g: 0, b: 0 };
      if (a.type === "text" && a.text) {
        page.drawText(a.text, { x: px, y: py - (a.fontSize ?? 16), size: a.fontSize ?? 16, font, color: rgb(col.r, col.g, col.b) });
      } else if (a.type === "signature" && a.imgDataUrl) {
        const bytes = dataUrlToBytes(a.imgDataUrl);
        const img = await doc.embedPng(bytes);
        const w = (a.w ?? 0.2) * width, h = (a.h ?? 0.08) * height;
        page.drawImage(img, { x: px, y: py - h, width: w, height: h });
      } else if (a.type === "highlight") {
        const w = (a.w ?? 0.2) * width, h = (a.h ?? 0.03) * height;
        page.drawRectangle({ x: px, y: py - h, width: w, height: h, color: rgb(col.r, col.g, col.b), opacity: 0.4 });
      }
    }
    const bytes = await doc.save();
    return new Blob([bytes as BlobPart], { type: MIME.pdf });
  };

  const download = async () => {
    const blob = await buildPdf();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`; a.click();
  };
  const doPrint = async () => {
    const blob = await buildPdf();
    const url = URL.createObjectURL(blob);
    const w = window.open(url); if (w) setTimeout(() => w.print(), 500);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-2 p-2 flex-wrap">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard/office"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link>
          </Button>
          <Input value={fileName} onChange={e => setFileName(e.target.value)} className="max-w-xs h-8" />
          <Separator orientation="vertical" className="h-6" />
          <label className="cursor-pointer">
            <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" />เปิดไฟล์</span></Button>
          </label>
          <label className="cursor-pointer">
            <input type="file" accept=".pdf" multiple className="hidden" onChange={e => e.target.files && handleMerge(e.target.files)} />
            <Button variant="outline" size="sm" asChild><span><Merge className="w-4 h-4 mr-1" />รวม</span></Button>
          </label>
          <div className="ml-auto flex items-center gap-2">
            {pdfBytes && (
              <>
                <Button variant="outline" size="sm" onClick={doPrint}><Printer className="w-4 h-4 mr-1" />พิมพ์</Button>
                <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />โหลด</Button>
                <SaveToDriveButton fileId={fileId} fileName={fileName} defaultName="เอกสาร.pdf"
                  mimeType={MIME.pdf} getBlob={buildPdf}
                  onSaved={(id, name) => { setFileId(id); setFileName(name); }} />
              </>
            )}
          </div>
        </div>
      </div>

      {!pdfBytes ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">อัปโหลดไฟล์ PDF เพื่อเริ่มต้น</p>
            <label className="inline-block cursor-pointer">
              <input type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
              <Button asChild><span><Upload className="w-4 h-4 mr-2" />เลือกไฟล์ PDF</span></Button>
            </label>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Tools */}
          <aside className="w-64 border-r bg-background overflow-y-auto p-3 space-y-3">
            <div className="space-y-2">
              <Button variant={tool === "text" ? "default" : "outline"} size="sm" className="w-full justify-start" onClick={() => setTool(tool === "text" ? "none" : "text")}>
                <Type className="w-4 h-4 mr-2" />ใส่ข้อความ
              </Button>
              {tool === "text" && (
                <div className="space-y-2 p-2 border rounded">
                  <Textarea value={textDraft} onChange={e => setTextDraft(e.target.value)} placeholder="พิมพ์แล้วคลิกในหน้า" rows={2} />
                  <div className="flex gap-1 items-center text-xs">
                    <Input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-10 h-8 p-0" />
                    <Input type="number" value={textSize} onChange={e => setTextSize(Number(e.target.value))} className="h-8" />
                  </div>
                </div>
              )}

              <Button variant={tool === "highlight" ? "default" : "outline"} size="sm" className="w-full justify-start" onClick={() => setTool(tool === "highlight" ? "none" : "highlight")}>
                <Highlighter className="w-4 h-4 mr-2" />ไฮไลต์
              </Button>
              {tool === "highlight" && (
                <Input type="color" value={hlColor} onChange={e => setHlColor(e.target.value)} className="w-full h-8 p-0" />
              )}

              <Button variant={tool === "signature" ? "default" : "outline"} size="sm" className="w-full justify-start" onClick={() => setTool(tool === "signature" ? "none" : "signature")}>
                <Signature className="w-4 h-4 mr-2" />ลายเซ็น
              </Button>
              {tool === "signature" && (
                <div className="space-y-2">
                  <canvas ref={sigCanvasRef} width={400} height={150}
                    className="border rounded bg-white w-full touch-none"
                    onMouseDown={sigStart} onMouseMove={sigMove} onMouseUp={sigEnd} onMouseLeave={sigEnd}
                    onTouchStart={sigStart} onTouchMove={sigMove} onTouchEnd={sigEnd} />
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={sigClear}>ล้าง</Button>
                    <Button size="sm" onClick={sigSave}>บันทึก</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">แล้วคลิกในหน้าที่ต้องการวาง</p>
                </div>
              )}

              <Separator />
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={rotatePage}><RotateCw className="w-4 h-4 mr-2" />หมุนหน้านี้</Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={extractPage}>📄 ดึงหน้านี้เป็น PDF</Button>
              <Button variant="outline" size="sm" className="w-full justify-start text-destructive" onClick={deletePage}>ลบหน้านี้</Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setAnnots(a => a.filter(x => x.page !== pageIdx))}>
                <Trash2 className="w-4 h-4 mr-2" />ล้างเครื่องหมายหน้านี้
              </Button>
            </div>

            <Separator />
            <div className="flex items-center justify-between gap-1">
              <Button size="sm" variant="outline" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}><ZoomOut className="w-4 h-4" /></Button>
              <span className="text-xs">{Math.round(scale * 100)}%</span>
              <Button size="sm" variant="outline" onClick={() => setScale(s => Math.min(2, s + 0.1))}><ZoomIn className="w-4 h-4" /></Button>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={pageIdx === 0} onClick={() => setPageIdx(pageIdx - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <Input type="number" value={pageIdx + 1} min={1} max={numPages}
                onChange={e => setPageIdx(Math.max(0, Math.min(numPages - 1, Number(e.target.value) - 1)))}
                className="h-8 text-center" />
              <span className="text-xs text-muted-foreground">/ {numPages}</span>
              <Button size="sm" variant="outline" disabled={pageIdx >= numPages - 1} onClick={() => setPageIdx(pageIdx + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>

            {/* Page thumbnails */}
            <div className="space-y-1 border-t pt-2">
              <div className="text-xs text-muted-foreground">หน้าทั้งหมด</div>
              <div className="max-h-96 overflow-y-auto space-y-1">
                {Array.from({ length: numPages }, (_, i) => (
                  <button key={i} onClick={() => setPageIdx(i)}
                    className={`w-full aspect-[1/1.4] border-2 rounded overflow-hidden bg-white ${i === pageIdx ? "border-primary" : "border-border"}`}>
                    <Document file={pdfBytes ? { data: pdfBytes } : undefined}>
                      <Page pageNumber={i + 1} width={180} rotate={rotations[i] ?? 0} renderTextLayer={false} renderAnnotationLayer={false} />
                    </Document>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Viewer */}
          <div className="flex-1 overflow-auto p-4 flex justify-center bg-slate-200">
            <div ref={pageWrapRef} className={`relative inline-block shadow-2xl ${tool !== "none" ? "cursor-crosshair" : "cursor-default"}`}
              onClick={handlePageClick}>
              <Document file={pdfBytes ? { data: pdfBytes } : undefined} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
                <Page pageNumber={pageIdx + 1} width={800 * scale} rotate={rotations[pageIdx] ?? 0} />
              </Document>
              {annots.filter(a => a.page === pageIdx).map(a => (
                <div key={a.id}
                  onPointerDown={e => startDragAnnot(e, a.id)}
                  onDoubleClick={() => setAnnots(list => list.filter(x => x.id !== a.id))}
                  style={{ position: "absolute", left: `${a.x * 100}%`, top: `${a.y * 100}%`, cursor: "move" }}
                  title="ลาก = ย้าย, ดับเบิลคลิก = ลบ">
                  {a.type === "text" ? (
                    <span style={{ fontSize: (a.fontSize ?? 16) * scale, color: a.color, background: "rgba(255,255,0,0.15)", padding: "0 2px", whiteSpace: "nowrap" }}>{a.text}</span>
                  ) : a.type === "signature" ? (
                    <img src={a.imgDataUrl} style={{ width: `${(a.w ?? 0.2) * 800 * scale}px` }} alt="signature" draggable={false} />
                  ) : (
                    <div style={{ width: `${(a.w ?? 0.2) * 800 * scale}px`, height: `${(a.h ?? 0.03) * 1100 * scale}px`, background: a.color, opacity: 0.4 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getPos(e: React.MouseEvent | React.TouchEvent) {
  const target = e.currentTarget as HTMLCanvasElement;
  const rect = target.getBoundingClientRect();
  const scaleX = target.width / rect.width, scaleY = target.height / rect.height;
  if ("touches" in e) {
    const t = e.touches[0] ?? e.changedTouches[0];
    return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
  }
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return { r, g, b };
}
