import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, FileType2, Upload, Download, Loader2, Save, FilePlus, Send, Maximize2, Minimize2, BookOpen, Globe, Pencil, History, Trash2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import RichDocEditor from "@/components/editor/RichDocEditor";
import PdfAnnotator from "@/components/editor/PdfAnnotator";
import { supabase } from "@/integrations/supabase/client";
import { DateInput } from "@/components/ui/date-input";

type Mode = "idle" | "word" | "pdf";

type DocHistoryItem = {
  id: string;
  name: string;
  html: string;
  createdAt: number;
  updatedAt: number;
};

const HISTORY_KEY = "doc_editor_history_v1";

function loadHistory(): DocHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DocHistoryItem[];
  } catch { return []; }
}
function saveHistory(items: DocHistoryItem[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50))); } catch {}
}

export default function DocEditorPage() {
  const [mode, setMode] = useState<Mode>("idle");
  const [filename, setFilename] = useState("untitled");
  const [html, setHtml] = useState("<p></p>");
  const [loading, setLoading] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTitle, setSendTitle] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [sending, setSending] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [hwOpen, setHwOpen] = useState(false);
  const [hwTitle, setHwTitle] = useState("");
  const [hwDesc, setHwDesc] = useState("");
  const [hwDue, setHwDue] = useState("");
  const [hwClassroom, setHwClassroom] = useState<string>("");
  const [hwSubject, setHwSubject] = useState<string>("");
  const [hwSending, setHwSending] = useState(false);
  const [classrooms, setClassrooms] = useState<Array<{ id: string; name: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name_th: string }>>([]);
  const [history, setHistory] = useState<DocHistoryItem[]>(() => loadHistory());
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);

  const persistDraft = (overrides?: { name?: string; html?: string }) => {
    const name = overrides?.name ?? filename;
    const content = overrides?.html ?? html;
    if (!content || content === "<p></p>") return;
    const now = Date.now();
    setHistory(prev => {
      let next: DocHistoryItem[];
      if (currentDocId) {
        next = prev.map(h => h.id === currentDocId ? { ...h, name, html: content, updatedAt: now } : h);
      } else {
        const id = `doc_${now}_${Math.random().toString(36).slice(2, 7)}`;
        setCurrentDocId(id);
        next = [{ id, name, html: content, createdAt: now, updatedAt: now }, ...prev];
      }
      saveHistory(next);
      return next;
    });
  };

  const openFromHistory = (item: DocHistoryItem) => {
    setHtml(item.html);
    setFilename(item.name);
    setCurrentDocId(item.id);
    setMode("word");
    setFullscreen(true);
  };

  const deleteFromHistory = (id: string) => {
    if (!confirm("ลบเอกสารนี้ออกจากประวัติ?")) return;
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      saveHistory(next);
      return next;
    });
    if (currentDocId === id) setCurrentDocId(null);
    toast.success("ลบแล้ว");
  };
  

  useEffect(() => {
    (async () => {
      const [{ data: cls }, { data: sub }] = await Promise.all([
        supabase.from("classrooms").select("id,name").order("name"),
        supabase.from("subjects").select("id,name_th").order("name_th"),
      ]);
      setClassrooms((cls as any) || []);
      setSubjects((sub as any) || []);
    })();
  }, []);

  const sendAsHomework = async () => {
    if (!hwClassroom) { toast.error("กรุณาเลือกห้องเรียน"); return; }
    setHwSending(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("homework_assignments").insert({
        title: hwTitle || filename,
        description: `${hwDesc ? hwDesc + "\n\n---\n" : ""}${html}`,
        classroom_id: hwClassroom,
        subject_id: hwSubject || null,
        due_date: hwDue || null,
        assigned_by: u.user?.id || null,
        status: "active",
      } as any);
      if (error) throw error;
      toast.success("ส่งเป็นการบ้านแล้ว");
      persistDraft();
      setHwOpen(false);
      setHwTitle(""); setHwDesc(""); setHwDue("");
    } catch (e: any) {
      toast.error("ส่งไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setHwSending(false);
    }
  };

  const reset = () => {
    setMode("idle");
    setHtml("<p></p>");
    setPdfBlob(null);
    setFilename("untitled");
    setCurrentDocId(null);
  };

  const newDocument = () => {
    setMode("word");
    setHtml("<p></p>");
    setFilename(`เอกสารใหม่_${new Date().toLocaleDateString("th-TH")}`);
    setCurrentDocId(null);
    setFullscreen(true);
  };

  const sendInSystem = async () => {
    setSending(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const docNumber = `DOC-${Date.now()}`;
      const { error } = await supabase.from("documents").insert({
        doc_number: docNumber,
        title: sendTitle || filename,
        doc_type: "internal",
        notes: `${sendNote ? sendNote + "\n\n---\n" : ""}${html}`,
        created_by: u.user?.id,
      } as any);
      if (error) throw error;
      toast.success("ส่งเข้าระบบเอกสารแล้ว");
      persistDraft();
      setSendOpen(false);
      setSendTitle(""); setSendNote("");
    } catch (e: any) {
      toast.error("ส่งไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setSending(false);
    }
  };

  const handleFile = async (file: File) => {
    const baseName = file.name.replace(/\.[^.]+$/, "") || "untitled";
    setFilename(baseName);
    setLoading(true);
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      if (ext === "docx" || ext === "doc") {
        const buf = await file.arrayBuffer();
        const mammoth: any = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        setHtml(result.value || "<p></p>");
        setMode("word");
        setFullscreen(true);
      } else if (ext === "pdf") {
        setPdfBlob(file);
        setMode("pdf");
        setPdfOpen(true);
        setFullscreen(true);
      } else if (ext === "html" || ext === "htm" || ext === "txt") {
        const text = await file.text();
        setHtml(ext === "txt" ? `<pre>${text.replace(/</g, "&lt;")}</pre>` : text);
        setMode("word");
        setFullscreen(true);
      } else {
        toast.error("รองรับเฉพาะไฟล์ .docx .doc .pdf .html .txt");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("เปิดไฟล์ไม่สำเร็จ: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const downloadDocx = async () => {
    try {
      const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:'TH Sarabun New','IBM Plex Sans Thai',sans-serif;font-size:16pt;}
        h1{font-size:24pt;} h2{font-size:20pt;} h3{font-size:18pt;}
        table{border-collapse:collapse;} td,th{border:1px solid #888;padding:4px;}
      </style></head><body>${html}</body></html>`;
      const { asBlob } = await import("html-docx-js-typescript");
      const out = await asBlob(full);
      const blob = out instanceof Blob ? out : new Blob([out as any], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${filename}.docx`; a.click();
      URL.revokeObjectURL(url);
      toast.success("ดาวน์โหลด Word แล้ว");
      persistDraft();
    } catch (e: any) {
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || e));
    }
  };

  const downloadPdf = () => {
    // Use the browser's print dialog — user picks "Save as PDF" target.
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) { toast.error("เบราว์เซอร์บล็อกหน้าต่างใหม่ — เปิด popup แล้วลองอีกครั้ง"); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title>
      <style>
        @page { size: A4; margin: 20mm; }
        body{font-family:'TH Sarabun New','IBM Plex Sans Thai',sans-serif;font-size:16pt;}
        h1{font-size:24pt;} h2{font-size:20pt;} h3{font-size:18pt;}
        table{border-collapse:collapse;width:100%;} td,th{border:1px solid #888;padding:4px;}
        img{max-width:100%;}
      </style></head><body>${html}<script>window.onload=()=>{window.focus();window.print();}<\/script></body></html>`);
    w.document.close();
    persistDraft();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            เครื่องมือเอกสาร (Word / PDF)
          </h1>
          <p className="text-muted-foreground text-sm">
            อัปโหลดไฟล์ Word (.docx) หรือ PDF เพื่อเปิดอ่าน แก้ไข เซ็น และส่งออกใหม่
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".docx,.doc,.pdf,.html,.htm,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={newDocument}>
            <FilePlus className="w-4 h-4 mr-2" /> เอกสารใหม่
          </Button>
          <Button onClick={() => inputRef.current?.click()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            อัปโหลดไฟล์
          </Button>
          <Button variant="default" className="bg-warning hover:bg-warning text-white" onClick={() => window.open("/dashboard/admin/worksheets","_blank")}>
            <Globe className="w-4 h-4 mr-2" /> ใบงานในระบบ
          </Button>
          {mode !== "idle" && (
            <Button variant="outline" onClick={reset}>เริ่มใหม่</Button>
          )}
        </div>
      </div>

      {mode === "idle" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-md transition border-primary/40" onClick={newDocument}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FilePlus className="w-5 h-5 text-success" /> สร้างเอกสารใหม่
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              เริ่มเอกสารเปล่าด้วย Editor แบบ Word — ไม้บรรทัด, คั่นหน้า, แทรกรูป, ส่งออก Word/PDF, ส่งในระบบ
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition" onClick={() => inputRef.current?.click()}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileType2 className="w-5 h-5 text-info" /> เปิดไฟล์ Word
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              อัปโหลด .docx เพื่อแก้ไขด้วย Rich Editor (TipTap) แล้วส่งออกเป็น Word หรือ PDF
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition" onClick={() => inputRef.current?.click()}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-danger" /> เปิดไฟล์ PDF
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              อ่าน เน้นข้อความ เซ็นชื่อ แทรกข้อความ บน PDF แล้วบันทึกเป็นไฟล์ใหม่
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "idle" && history.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-5 h-5 text-primary" /> ประวัติเอกสารที่สร้าง ({history.length})
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => {
                if (!confirm("ล้างประวัติทั้งหมด?")) return;
                setHistory([]); saveHistory([]); toast.success("ล้างประวัติแล้ว");
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" /> ล้างทั้งหมด
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {history.map(item => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2">
                  <button
                    className="flex-1 text-left min-w-0 hover:text-primary"
                    onClick={() => openFromHistory(item)}
                  >
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      แก้ไขล่าสุด {new Date(item.updatedAt).toLocaleString("th-TH")}
                    </div>
                  </button>
                  <Button size="sm" variant="outline" onClick={() => openFromHistory(item)}>
                    <FolderOpen className="w-4 h-4 mr-1" /> เปิด
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteFromHistory(item.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}


      {mode === "word" && (() => {
        const node = (
        <Card className={cn(fullscreen && "rounded-none border-0 flex flex-col h-full [&>*:first-child]:shrink-0 [&>*:last-child]:flex-1 [&>*:last-child]:overflow-auto [&>*:last-child]:min-h-0")}>



          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap sticky top-0 bg-card z-10 border-b">
            {editingName ? (
              <Input
                autoFocus
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingName(false); }}
                className="h-8 max-w-xs"
              />
            ) : (
              <CardTitle
                className="text-base truncate cursor-pointer hover:text-primary inline-flex items-center gap-1"
                onClick={() => setEditingName(true)}
                title="คลิกเพื่อเปลี่ยนชื่อ"
              >
                {filename}.docx <Pencil className="w-3.5 h-3.5 opacity-60" />
              </CardTitle>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="secondary" onClick={() => { persistDraft(); toast.success("บันทึกร่างแล้ว"); }}>
                <Save className="w-4 h-4 mr-1" /> บันทึกร่าง
              </Button>
              <Button size="sm" className="bg-warning hover:bg-warning text-white" onClick={() => window.open("/dashboard/admin/worksheets","_blank")}>
                <Globe className="w-4 h-4 mr-1" /> ใบงานในระบบ
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setHwTitle(filename); setHwOpen(true); }}>
                <BookOpen className="w-4 h-4 mr-1" /> ส่งเป็นการบ้าน
              </Button>
              <Button size="sm" variant="outline" onClick={downloadPdf}>
                <Download className="w-4 h-4 mr-1" /> ดาวน์โหลด PDF
              </Button>
              <Button size="sm" onClick={downloadDocx}>
                <Save className="w-4 h-4 mr-1" /> ดาวน์โหลด Word
              </Button>
              <Button size="sm" variant="outline" onClick={() => setFullscreen(f => !f)} title={fullscreen ? "ออกเต็มจอ" : "เต็มจอ"}>
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className={cn(fullscreen && "p-2 sm:p-4")}>
            <RichDocEditor
              value={html}
              onChange={setHtml}
              minHeight={fullscreen ? "calc(100vh - 110px)" : "65vh"}
              pageStyle
              onNewDocument={newDocument}
              onSendInSystem={(h) => { setHtml(h); setSendTitle(filename); setSendOpen(true); }}
            />
          </CardContent>
        </Card>
        );
        return fullscreen ? createPortal(
          <div className="fixed inset-0 z-[9999] bg-background">{node}</div>,
          document.body
        ) : node;
      })()}




      {mode === "pdf" && (() => {
        const node = (
        <Card className={cn(fullscreen && "rounded-none border-0 flex flex-col h-full [&>*:first-child]:shrink-0 [&>*:last-child]:flex-1 [&>*:last-child]:overflow-auto [&>*:last-child]:min-h-0")}>

          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 flex-wrap sticky top-0 bg-card z-10 border-b">
            {editingName ? (
              <Input
                autoFocus
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingName(false); }}
                className="h-8 max-w-xs"
              />
            ) : (
              <CardTitle
                className="text-base truncate cursor-pointer hover:text-primary inline-flex items-center gap-1"
                onClick={() => setEditingName(true)}
                title="คลิกเพื่อเปลี่ยนชื่อ"
              >
                {filename}.pdf <Pencil className="w-3.5 h-3.5 opacity-60" />
              </CardTitle>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => { setHwTitle(filename); setHwOpen(true); }}>
                <BookOpen className="w-4 h-4 mr-1" /> ส่งเป็นการบ้าน
              </Button>
              <Button size="sm" onClick={() => setPdfOpen(true)}>เปิดเครื่องมือแก้ไข</Button>
              <Button size="sm" variant="outline" onClick={() => setFullscreen(f => !f)} title={fullscreen ? "ออกเต็มจอ" : "เต็มจอ"}>
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {pdfBlob && (
              <iframe
                src={URL.createObjectURL(pdfBlob)}
                className="w-full rounded border"
                style={{ height: fullscreen ? "calc(100vh - 90px)" : "70vh" }}
                title="pdf-preview"
              />
            )}
          </CardContent>
        </Card>
        );
        return fullscreen ? createPortal(<div className="fixed inset-0 z-[9999] bg-background">{node}</div>, document.body) : node;
      })()}


      <PdfAnnotator
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        pdfBlob={pdfBlob}
        filename={`${filename}.pdf`}
        onSave={async (blob, name) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = name; a.click();
          URL.revokeObjectURL(url);
          setPdfBlob(blob);
          toast.success("บันทึก PDF แล้ว");
        }}
      />

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle><Send className="w-4 h-4 inline mr-1" /> ส่งเอกสารเข้าระบบ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">ชื่อเอกสาร</label>
              <Input value={sendTitle} onChange={e => setSendTitle(e.target.value)} placeholder="ระบุชื่อเอกสาร" />
            </div>
            <div>
              <label className="text-xs font-medium">หมายเหตุ (ไม่บังคับ)</label>
              <Textarea value={sendNote} onChange={e => setSendNote(e.target.value)} rows={3} />
            </div>
            <p className="text-xs text-muted-foreground">เอกสารจะถูกบันทึกในระบบงานสารบรรณ พร้อมเนื้อหา HTML</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>ยกเลิก</Button>
            <Button onClick={sendInSystem} disabled={sending}>{sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />} ส่ง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={hwOpen} onOpenChange={setHwOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle><BookOpen className="w-4 h-4 inline mr-1" /> ส่งเป็นการบ้าน</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">ชื่อการบ้าน</label>
              <Input value={hwTitle} onChange={e => setHwTitle(e.target.value)} placeholder="เช่น ใบงานคณิตศาสตร์ บทที่ 1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">ห้องเรียน *</label>
                <Select value={hwClassroom} onValueChange={setHwClassroom}>
                  <SelectTrigger><SelectValue placeholder="เลือกห้อง" /></SelectTrigger>
                  <SelectContent>
                    {classrooms.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">วิชา</label>
                <Select value={hwSubject} onValueChange={setHwSubject}>
                  <SelectTrigger><SelectValue placeholder="เลือกวิชา" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name_th}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">กำหนดส่ง</label>
              <DateInput value={hwDue} onChange={e => setHwDue(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">คำชี้แจง (ไม่บังคับ)</label>
              <Textarea value={hwDesc} onChange={e => setHwDesc(e.target.value)} rows={2} />
            </div>
            <p className="text-xs text-muted-foreground">เนื้อหาเอกสารจะถูกแนบเข้าไปในการบ้านด้วย</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHwOpen(false)}>ยกเลิก</Button>
            <Button onClick={sendAsHomework} disabled={hwSending}>
              {hwSending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <BookOpen className="w-4 h-4 mr-1" />} ส่ง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}
