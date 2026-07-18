import { useEffect, useRef, useState } from "react";
import { SuperDoc, BlankDOCX, getFileObject, DOCX } from "@harbour-enterprises/superdoc";
import "@harbour-enterprises/superdoc/style.css";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Download, FileUp } from "lucide-react";
import { toast } from "sonner";

/**
 * SuperDocEditor — full Word-like editor (rulers, headers/footers, page-breaks,
 * image resize/wrap, native .docx). Wraps Harbour SuperDoc.
 */
export interface SuperDocEditorProps {
  /** Initial DOCX as Blob/File/URL — if missing uses a blank document */
  initialDocx?: Blob | File | string | null;
  /** Called when user clicks "บันทึก" — receives a .docx Blob */
  onSave?: (docx: Blob) => Promise<void> | void;
  /** Document title (shown in toolbar) */
  title?: string;
  /** Read-only mode */
  readOnly?: boolean;
}

export default function SuperDocEditor({ initialDocx, onSave, title = "เอกสาร", readOnly }: SuperDocEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const sdRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // unique DOM IDs so SuperDoc string selectors don't collide between mounts
  const ids = useRef({ host: `superdoc-${Math.random().toString(36).slice(2, 9)}`, tb: `superdoc-tb-${Math.random().toString(36).slice(2, 9)}` });


  // (re)mount SuperDoc whenever initialDocx changes
  useEffect(() => {
    let destroyed = false;
    (async () => {
      if (!containerRef.current || !toolbarRef.current) return;
      setLoading(true);
      try {
        // clear previous instance
        if (sdRef.current) {
          try { sdRef.current.destroy?.(); } catch {}
          sdRef.current = null;
        }
        containerRef.current.innerHTML = "";
        toolbarRef.current.innerHTML = "";

        // resolve initial data → File
        let data: File;
        if (initialDocx instanceof File) data = initialDocx;
        else if (initialDocx instanceof Blob)
          data = new File([initialDocx], `${title}.docx`, { type: DOCX });
        else if (typeof initialDocx === "string" && initialDocx)
          data = await getFileObject(initialDocx, `${title}.docx`, DOCX);
        else
          data = await getFileObject(BlankDOCX, `${title}.docx`, DOCX);
        if (destroyed) return;

        sdRef.current = new SuperDoc({
          selector: `#${ids.current.host}`,
          toolbar: `#${ids.current.tb}`,
          documentMode: readOnly ? "viewing" : "editing",
          pagination: true,
          rulers: true,
          documents: [{ id: "doc-1", type: "docx", data }],
        } as any);
        sdRef.current.on?.("ready", () => { if (!destroyed) setLoading(false); });
        // Fallback: hide loader after 3s even if ready event missed
        setTimeout(() => { if (!destroyed) setLoading(false); }, 3000);
      } catch (err: any) {
        console.error("SuperDoc init failed:", err);
        toast.error("เปิด editor ไม่สำเร็จ: " + (err?.message || err));
        setLoading(false);
      }
    })();
    return () => {
      destroyed = true;
      try { sdRef.current?.destroy?.(); } catch {}
      sdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDocx]);

  const exportDocx = async (): Promise<Blob | null> => {
    if (!sdRef.current) return null;
    try {
      const result = await sdRef.current.export({ exportType: "docx" });
      // export() may return a Blob or { blob }/Array of blobs
      if (result instanceof Blob) return result;
      if (Array.isArray(result) && result[0] instanceof Blob) return result[0];
      if (result?.blob instanceof Blob) return result.blob;
      return null;
    } catch (err: any) {
      console.error(err);
      toast.error("Export ไม่สำเร็จ: " + (err?.message || err));
      return null;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const blob = await exportDocx();
    if (blob) {
      try { await onSave?.(blob); }
      catch (err: any) { toast.error("บันทึกไม่สำเร็จ: " + (err?.message || err)); }
    }
    setSaving(false);
  };

  const handleDownload = async () => {
    const blob = await exportDocx(); if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title}.docx`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!f.name.toLowerCase().endsWith(".docx")) {
      toast.error("รองรับเฉพาะไฟล์ .docx"); e.target.value = ""; return;
    }
    // Re-mount by setting state via key — simplest: dispatch into the editor
    if (sdRef.current?.documents?.[0]) {
      try {
        await sdRef.current.replaceDocument?.({ id: "doc-1", type: "docx", data: f });
        toast.success("นำเข้าไฟล์สำเร็จ");
      } catch {
        // fallback: full reinit (handled by parent passing new initialDocx)
        location.reload();
      }
    }
    e.target.value = "";
  };

  return (
    <div className="flex h-full flex-col bg-editor-canvas">
      {/* Custom action bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b bg-white">
        <span className="font-semibold text-sm truncate">📄 {title}</span>
        <div className="ml-auto flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={handleImport} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={readOnly}>
            <FileUp className="w-4 h-4 mr-1" />นำเข้า .docx
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-1" />ดาวน์โหลด .docx
          </Button>
          {!readOnly && onSave && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              บันทึกเข้าเทมเพลต
            </Button>
          )}
        </div>
      </div>

      {/* SuperDoc native toolbar */}
      <div ref={toolbarRef} id={ids.current.tb} className="shrink-0 border-b bg-white" />

      {/* Editor surface — Word-like canvas: paper centered with breathing room */}
      <div className="relative flex-1 overflow-auto bg-editor-canvas">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
        <div className="min-h-full flex justify-center py-10 px-6">
          <div ref={containerRef} id={ids.current.host} className="superdoc-host w-full max-w-[850px]" />
        </div>
      </div>
    </div>
  );
}
