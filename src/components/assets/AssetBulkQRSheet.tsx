import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  assets: any[];
  onRemove?: (id: string) => void;
}

/**
 * พิมพ์ QR สติกเกอร์หลายชิ้นพร้อมกันบน A4 (4 คอลัมน์ × 8 แถว = 32 ชิ้น/หน้า)
 * ขนาดสติกเกอร์ประมาณ 48×33 มม.
 */
export const AssetBulkQRSheet = ({ open, onClose, assets, onRemove }: Props) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const html = sheetRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    w.document.write(`
      <html><head><title>QR สติกเกอร์ครุภัณฑ์ (${assets.length} ชิ้น)</title>
      <style>
        @page { size: A4; margin: 8mm; }
        body { font-family: 'Sarabun', system-ui, sans-serif; margin: 0; padding: 0; }
        .sheet { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; }
        .label { border: 1px dashed #999; padding: 3mm; text-align: center; break-inside: avoid; page-break-inside: avoid; }
        .label svg { display: block; margin: 0 auto; }
        .name { font-size: 9pt; font-weight: 600; margin-top: 2mm; line-height: 1.1; max-height: 22pt; overflow: hidden; }
        .code { font-family: monospace; font-size: 8pt; margin-top: 1mm; }
        .sn { font-size: 7pt; color: #444; }
        @media print { .label { border-color: #ccc; } }
      </style></head><body>${html}
      <script>window.onload=()=>{setTimeout(()=>{window.print();},200);}</script>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>พิมพ์ QR สติกเกอร์ครุภัณฑ์ ({assets.length} ชิ้น)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          A4 — 4 คอลัมน์ × 8 แถว ({Math.ceil(assets.length / 32)} หน้า). แต่ละสติกเกอร์ลิงก์ไปที่หน้าข้อมูลครุภัณฑ์
        </p>
        <div ref={sheetRef}>
          <div className="sheet" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
            {assets.map((a) => {
              const url = `${window.location.origin}/asset/${a.id}`;
              return (
                <div
                  key={a.id}
                  className="label"
                  style={{ border: "1px dashed #999", padding: "8px", textAlign: "center", background: "#fff", position: "relative" }}
                >
                  <QRCodeSVG value={url} size={90} level="M" includeMargin={false} />
                  <div className="name" style={{ fontSize: "10px", fontWeight: 600, marginTop: "4px", lineHeight: 1.1 }}>{a.asset_name}</div>
                  <div className="code" style={{ fontFamily: "monospace", fontSize: "9px", marginTop: "2px" }}>{a.asset_code}</div>
                  {a.serial_number && (
                    <div className="sn" style={{ fontSize: "8px", color: "#444" }}>S/N: {a.serial_number}</div>
                  )}
                  {onRemove && (
                    <button
                      onClick={() => onRemove(a.id)}
                      className="no-print"
                      style={{ position: "absolute", top: 2, right: 2, background: "transparent", border: "none", cursor: "pointer" }}
                      aria-label="ลบ"
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 sticky bottom-0 bg-background pt-2">
          <Button onClick={handlePrint} className="flex-1" disabled={assets.length === 0}>
            <Printer className="w-4 h-4 mr-2" />พิมพ์ทั้งหมด ({assets.length} ชิ้น)
          </Button>
          <Button variant="outline" onClick={onClose}>ปิด</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssetBulkQRSheet;
