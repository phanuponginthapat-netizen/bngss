import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X } from "lucide-react";
import RichDocEditor from "./RichDocEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  html: string;
  filename?: string;
}

/**
 * เปิดเอกสาร (HTML) ขึ้นมาให้แก้ไขก่อนพิมพ์/ส่งออก — Word-like full toolbar
 */
export default function EditBeforeExportDialog({ open, onOpenChange, title, html, filename = "document" }: Props) {
  const [content, setContent] = useState(html);

  useEffect(() => { if (open) setContent(html); }, [open, html]);

  const wrap = (inner: string) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:'TH Sarabun New','Sarabun',serif;font-size:16pt;color:#000;padding:1.5cm;}
    table{border-collapse:collapse;width:100%;} td,th{border:1px solid #333;padding:4px 6px;}
    th{background:#f0f0f0;} img{max-width:100%;}
    h1{font-size:24pt;} h2{font-size:20pt;} h3{font-size:18pt;}
    @page{size:A4;margin:1.5cm;}
  </style></head><body>${inner}</body></html>`;

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=900,height=1200"); if (!w) return;
    w.document.write(wrap(content) + `<script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},400));</script>`);
    w.document.close();
  };
  const handleDocx = async () => {
    const { asBlob } = await import("html-docx-js-typescript");
    const out = await asBlob(wrap(content));
    const blob = out instanceof Blob ? out : new Blob([out as any], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${filename}.docx`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขก่อนส่งออก — {title}</DialogTitle>
        </DialogHeader>
        <RichDocEditor
          value={content}
          onChange={setContent}
          minHeight="60vh"
          onPrint={() => handlePrint()}
          onExportDocx={() => handleDocx()}
          onExportPdf={() => handlePrint()}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}><X className="w-4 h-4 mr-1" />ปิด</Button>
          <Button variant="outline" onClick={handleDocx}><Download className="w-4 h-4 mr-1" />Word</Button>
          <Button onClick={handlePrint}><Printer className="w-4 h-4 mr-1" />พิมพ์ / PDF</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
