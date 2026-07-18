import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, QrCode } from "lucide-react";
import { useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  asset: any | null;
}

export const AssetQRCode = ({ open, onClose, asset }: Props) => {
  const printRef = useRef<HTMLDivElement>(null);
  if (!asset) return null;

  const url = `${window.location.origin}/asset/${asset.id}`;

  const handlePrint = () => {
    const html = printRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`
      <html><head><title>QR ${asset.asset_code}</title>
      <style>
        body{font-family:sans-serif;text-align:center;padding:20px;margin:0}
        .label{border:2px solid #000;padding:16px;border-radius:8px;display:inline-block}
        .code{font-family:monospace;font-weight:bold;font-size:14px;margin-top:8px}
        .name{font-size:16px;font-weight:600;margin:4px 0}
        .sn{font-size:11px;color:#444;margin-top:4px}
        .hint{font-size:10px;color:#666;margin-top:8px}
        @media print { body{padding:0} }
      </style></head><body>${html}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script></body></html>
    `);
    w.document.close();
  };

  const handleDownload = () => {
    const svg = document.querySelector(`#qr-${asset.id} svg`) as SVGElement | null;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-${asset.asset_code}.svg`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" /> QR Code ทรัพย์สิน
          </DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <div id={`qr-${asset.id}`} ref={printRef}>
            <div className="label" style={{ border: "2px solid #000", padding: 16, borderRadius: 8, textAlign: "center", background: "#fff" }}>
              <QRCodeSVG value={url} size={180} level="M" includeMargin />
              <div className="name" style={{ fontSize: 14, fontWeight: 600, marginTop: 6 }}>{asset.asset_name}</div>
              <div className="code" style={{ fontFamily: "monospace", fontSize: 12, marginTop: 2 }}>{asset.asset_code}</div>
              {asset.serial_number && (
                <div className="sn" style={{ fontSize: 10, color: "#444", marginTop: 2 }}>S/N: {asset.serial_number}</div>
              )}
              <div className="hint" style={{ fontSize: 9, color: "#666", marginTop: 6 }}>สแกนเพื่อดูข้อมูลและคืนทรัพย์สิน</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-center text-muted-foreground break-all">{url}</p>
        <div className="flex gap-2">
          <Button onClick={handlePrint} className="flex-1" variant="default">
            <Printer className="w-4 h-4 mr-2" />พิมพ์ป้าย
          </Button>
          <Button onClick={handleDownload} className="flex-1" variant="outline">
            <Download className="w-4 h-4 mr-2" />ดาวน์โหลด SVG
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssetQRCode;
