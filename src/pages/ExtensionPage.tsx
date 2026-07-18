import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Puzzle, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function ExtensionPage() {
  const download = () => {
    fetch("/school-safe-browser.zip")
      .then((r) => { if (!r.ok) throw new Error("โหลดไม่สำเร็จ"); return r.blob(); })
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "school-safe-browser.zip";
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("ดาวน์โหลดแล้ว — แตกไฟล์และติดตั้งใน Chrome");
      })
      .catch((e) => toast.error(e.message));
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Puzzle className="w-8 h-8 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-bold">Safe Browser Extension</h1>
          <p className="text-sm text-muted-foreground">
            ส่วนขยาย Chrome ที่เชื่อมกับระบบโรงเรียน บันทึกการใช้เว็บ กรองเนื้อหา และแสดงปุ่มกลับสู่ระบบทุกหน้า
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">ดาวน์โหลดและติดตั้ง</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={download} size="lg" className="gap-2">
            <Download className="w-4 h-4" /> ดาวน์โหลด school-safe-browser.zip
          </Button>
          <ol className="text-sm space-y-2 list-decimal pl-5">
            <li>แตกไฟล์ zip ที่ดาวน์โหลด</li>
            <li>เปิด <code className="px-1 bg-muted rounded">chrome://extensions</code></li>
            <li>เปิด <b>Developer mode</b> (มุมบนขวา)</li>
            <li>คลิก <b>Load unpacked</b> เลือกโฟลเดอร์ที่แตกไว้</li>
            <li>เข้าเว็บระบบโรงเรียนเพื่อเชื่อมต่อบัญชีอัตโนมัติ</li>
          </ol>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground flex gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            เมื่อ Login เข้าระบบแล้ว ส่วนขยายจะซิงค์บัญชีอัตโนมัติ ไม่ต้องกรอกซ้ำ
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">ฟีเจอร์</CardTitle></CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 list-disc pl-5">
            <li>ซิงค์การเข้าสู่ระบบกับระบบโรงเรียนอัตโนมัติ</li>
            <li>บันทึกทุก URL ที่เข้า → ดูได้ที่ประวัติในระบบ</li>
            <li>บล็อกเว็บ/โฆษณาตามการตั้งค่า CMS ของโรงเรียน</li>
            <li>แถบเครื่องมือลอย: 🏠 กลับสู่ระบบ / ✕ ปิดแท็บ ทุกหน้าเว็บ</li>
            <li>ทำงานเข้ากันกับ Chrome Kiosk / Managed Guest Session</li>
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        สำหรับ IT: เปิดใช้เต็มรูปแบบผ่าน Chrome Enterprise Policy — force-install ส่วนขยายนี้และตั้ง homepage เป็น{" "}
        <a href="/dashboard/browser" className="underline inline-flex items-center gap-1">
          หน้า WebBrowser ในระบบ <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  );
}
