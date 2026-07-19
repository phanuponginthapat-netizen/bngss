import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Upload, Download, Type, Signature, Trash2, RotateCw, Merge } from "lucide-react";
import { downloadFile, getFileMeta, MIME } from "@/lib/office/driveFileIO";
import { SaveToDriveButton } from "@/components/office/SaveToDriveButton";
import { swal } from "@/lib/swal";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Annotation {
  page: number;   // 0-indexed
  x: number;      // fraction of width
  y: number;      // fraction of height (from top)
  type: "text" | "signature";
  text?: string;
  fontSize?: number;
  imgDataUrl?: string;
  w?: number;
  h?: number;
}

export default function PdfToolsPage() {
  const [sp] = useSearchParams();
  const fileIdParam = sp.get("file");
  const [fileId, setFileId] = useState<string | null>(fileIdParam);
  const [fileName, setFileName] = useState("เอกสาร.pdf");
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageIdx, setPageIdx] = useState(0);
  const [annots, setAnnots] = useState<Annotation[]>([]);
  const [tool, setTool] = useState<"none" | "text" | "signature">("none");
  const [textDraft, setTextDraft] = useState("");
  const [sigDraft, setSigDraft] = useState<string | null>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [rotations, setRotations] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!fileIdParam) return;
    (async () => {
      try {
        const meta = await getFileMeta(fileIdParam);
        setFileName(meta.name);
        const buf = await downloadFile(fileIdParam);
        setPdfBytes(new Uint8Array(buf));
      } catch (e: any) {
        swal.error("เปิดไฟล์ไม่สำเร็จ", String(e?.message ?? e));
      }
    })();
  }, [fileIdParam]);

  const handleUpload = async (file: File) => {
    const buf = await file.arrayBuffer();
    setPdfBytes(new Uint8Array(buf));
    setFileName(file.name);
    setFileId(null);
    setAnnots([]);
    setPageIdx(0);
  };

  const handleMerge = async (files: FileList) => {
    try {
      const merged = await PDFDocument.create();
      // include current
      if (pdfBytes) {
        const cur = await PDFDocument.load(pdfBytes);
        const copied = await merged.copyPages(cur, cur.getPageIndices());
        copied.forEach(p => merged.addPage(p));
      }
      for (const f of Array.from(files)) {
        const b = await f.arrayBuffer();
        const doc = await PDFDocument.load(b);
        const copied = await merged.copyPages(doc, doc.getPageIndices());
        copied.forEach(p => merged.addPage(p));
      }
      const bytes = await merged.save();
      setPdfBytes(bytes);
      setAnnots([]);
      setPageIdx(0);
      swal.toast("รวมไฟล์แล้ว");
    } catch (e: any) {
      swal.error("รวมไฟล์ไม่สำเร็จ", String(e?.message ?? e));
    }
  };

  const handlePageClick = (e: React.MouseEvent) => {
    if (tool === "none" || !pageWrapRef.current) return;
    const rect = pageWrapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (tool === "text") {
      if (!textDraft.trim()) { swal.warning("พิมพ์ข้อความก่อน"); return; }
      setAnnots(a => [...a, { page: pageIdx, x, y, type: "text", text: textDraft, fontSize: 16 }]);
    } else if (tool === "signature") {
      if (!sigDraft) { swal.warning("วาดลายเซ็นก่อน"); return; }
      setAnnots(a => [...a, { page: pageIdx, x, y, type: "signature", imgDataUrl: sigDraft, w: 0.2, h: 0.08 }]);
    }
  };

  const rotatePage = () => {
    setRotations(r => ({ ...r, [pageIdx]: ((r[pageIdx] ?? 0) + 90) % 360 }));
  };

  // Signature canvas draw
  const sigStart = (e: React.MouseEvent | React.TouchEvent) => {
    drawing.current = true;
    const ctx = sigCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    const p = getPos(e);
    ctx.moveTo(p.x, p.y);
  };
  const sigMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const ctx = sigCanvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.stroke();
  };
  const sigEnd = () => { drawing.current = false; };
  const sigClear = () => sigCanvasRef.current?.getContext("2d")?.clearRect(0, 0, 400, 150);
  const sigSave = () => {
    setSigDraft(sigCanvasRef.current?.toDataURL("image/png") ?? null);
    swal.toast("บันทึกลายเซ็นแล้ว");
  };

  const buildPdf = async (): Promise<Blob> => {
    if (!pdfBytes) throw new Error("ไม่มีไฟล์");
    const doc = await PDFDocument.load(pdfBytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    // Apply rotations
    for (const [idxStr, deg] of Object.entries(rotations)) {
      const p = doc.getPage(Number(idxStr));
      const cur = p.getRotation().angle;
      p.setRotation({ type: "degrees", angle: (cur + deg) % 360 } as any);
    }
    // Apply annotations
    for (const a of annots) {
      const page = doc.getPage(a.page);
      const { width, height } = page.getSize();
      const px = a.x * width;
      const py = height - a.y * height;
      if (a.type === "text" && a.text) {
        page.drawText(a.text, { x: px, y: py - (a.fontSize ?? 16), size: a.fontSize ?? 16, font, color: rgb(0, 0, 0) });
      } else if (a.type === "signature" && a.imgDataUrl) {
        const bytes = dataUrlToBytes(a.imgDataUrl);
        const img = await doc.embedPng(bytes);
        const w = (a.w ?? 0.2) * width;
        const h = (a.h ?? 0.08) * height;
        page.drawImage(img, { x: px, y: py - h, width: w, height: h });
      }
    }
    const bytes = await doc.save();
    return new Blob([bytes], { type: MIME.pdf });
  };

  const download = async () => {
    const blob = await buildPdf();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    a.click();
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
            <Button variant="outline" size="sm" asChild><span><Merge className="w-4 h-4 mr-1" />รวมไฟล์</span></Button>
          </label>
          <div className="ml-auto flex items-center gap-2">
            {pdfBytes && (
              <>
                <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />โหลด</Button>
                <SaveToDriveButton
                  fileId={fileId}
                  fileName={fileName}
                  defaultName="เอกสาร.pdf"
                  mimeType={MIME.pdf}
                  getBlob={buildPdf}
                  onSaved={(id, name) => { setFileId(id); setFileName(name); }}
                />
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
                <Textarea value={textDraft} onChange={e => setTextDraft(e.target.value)} placeholder="พิมพ์ข้อความ แล้วคลิกบนหน้า PDF" rows={2} />
              )}
              <Button variant={tool === "signature" ? "default" : "outline"} size="sm" className="w-full justify-start" onClick={() => setTool(tool === "signature" ? "none" : "signature")}>
                <Signature className="w-4 h-4 mr-2" />ลายเซ็น
              </Button>
              {tool === "signature" && (
                <div className="space-y-2">
                  <canvas
                    ref={sigCanvasRef}
                    width={400}
                    height={150}
                    className="border rounded bg-white w-full touch-none"
                    onMouseDown={sigStart} onMouseMove={sigMove} onMouseUp={sigEnd} onMouseLeave={sigEnd}
                    onTouchStart={sigStart} onTouchMove={sigMove} onTouchEnd={sigEnd}
                  />
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={sigClear}>ล้าง</Button>
                    <Button size="sm" onClick={sigSave}>บันทึก</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">แล้วคลิกบนหน้าที่ต้องการวางลายเซ็น</p>
                </div>
              )}
              <Separator />
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={rotatePage}>
                <RotateCw className="w-4 h-4 mr-2" />หมุนหน้านี้
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setAnnots(a => a.filter(x => x.page !== pageIdx))}>
                <Trash2 className="w-4 h-4 mr-2" />ล้างเครื่องหมายหน้านี้
              </Button>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              หน้า {pageIdx + 1} / {numPages}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" disabled={pageIdx === 0} onClick={() => setPageIdx(pageIdx - 1)}>ก่อน</Button>
              <Button size="sm" variant="outline" disabled={pageIdx >= numPages - 1} onClick={() => setPageIdx(pageIdx + 1)}>ถัด</Button>
            </div>
          </aside>

          {/* Viewer */}
          <div className="flex-1 overflow-auto p-4 flex justify-center">
            <div ref={pageWrapRef} className="relative inline-block cursor-crosshair" onClick={handlePageClick}>
              <Document file={pdfBytes} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
                <Page pageNumber={pageIdx + 1} width={800} rotate={rotations[pageIdx] ?? 0} />
              </Document>
              {annots.filter(a => a.page === pageIdx).map((a, i) => (
                <div key={i}
                  style={{
                    position: "absolute", left: `${a.x * 100}%`, top: `${a.y * 100}%`,
                    pointerEvents: "none",
                  }}
                >
                  {a.type === "text" ? (
                    <span style={{ fontSize: a.fontSize, color: "black", background: "rgba(255,255,0,0.2)", padding: "0 2px" }}>{a.text}</span>
                  ) : (
                    <img src={a.imgDataUrl} style={{ width: `${(a.w ?? 0.2) * 800}px` }} alt="signature" />
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
  const scaleX = target.width / rect.width;
  const scaleY = target.height / rect.height;
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
