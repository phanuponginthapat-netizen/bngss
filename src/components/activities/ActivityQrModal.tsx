import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function ActivityQrModal({ open, onOpenChange, activityId, title }: {
  open: boolean; onOpenChange: (v: boolean) => void; activityId: string; title: string;
}) {
  const url = `${window.location.origin}/dashboard/activities/${activityId}/register`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR ลงทะเบียนแข่งขัน</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG value={url} size={220} includeMargin={false} />
          </div>
          <div className="text-sm text-center text-muted-foreground line-clamp-2">{title}</div>
          <div className="flex flex-col w-full gap-2">
            <code className="text-xs bg-muted p-2 rounded break-all">{url}</code>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => {
                navigator.clipboard.writeText(url);
                toast.success("คัดลอกลิงก์แล้ว");
              }}>
                <Copy className="w-4 h-4" /> คัดลอก
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => window.open(url, "_blank")}>
                <ExternalLink className="w-4 h-4" /> เปิด
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              นักเรียนสแกน QR แล้วล็อกอินด้วยบัญชีนักเรียนเพื่อลงทะเบียนเอง
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
