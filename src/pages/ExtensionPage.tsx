import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Puzzle, ShieldCheck, ExternalLink, MonitorSmartphone, Power, QrCode, Lock } from "lucide-react";
import { toast } from "sonner";
import { saveErrorMessage } from "@/lib/saveError";

/** GitHub release สำหรับดาวน์โหลด/อัปเดตส่วนขยาย — ลิงก์ถาวรชี้ไฟล์ล่าสุดใน repo เสมอ */
export const GITHUB_EXTENSION_RELEASE_URL =
  "https://github.com/phanuponginthapat-netizen/bngss/releases/tag/extension-latest";
export const GITHUB_EXTENSION_DOWNLOAD_URL =
  "https://raw.githubusercontent.com/phanuponginthapat-netizen/bngss/main/public/extension.zip";
/** ตัวติดตั้งโปรแกรม BNG Safe Browser สำหรับ Windows (เบราว์เซอร์ + ส่วนขยายในตัว) */
export const SAFE_BROWSER_RELEASE_URL =
  "https://github.com/phanuponginthapat-netizen/bngss/releases/tag/safebrowser-windows-latest";
export const SAFE_BROWSER_SETUP_URL =
  "https://github.com/phanuponginthapat-netizen/bngss/releases/download/safebrowser-windows-latest/SafeBrowserSetup.exe";

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
      .catch((e) => toast.error(saveErrorMessage(e)));
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <MonitorSmartphone className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">BNG Safe Browser</h1>
          <p className="text-sm text-muted-foreground">
            โปรแกรมเบราว์เซอร์ปลอดภัยสำหรับ Windows มีส่วนขยายของโรงเรียนในตัว เปิดเต็มจอทุกครั้งที่เปิดเครื่อง
          </p>
        </div>
      </div>

      <Card className="border-primary/40">
        <CardHeader><CardTitle className="text-base">โปรแกรมสำหรับ Windows (แนะนำ)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" className="gap-2">
              <a href={SAFE_BROWSER_SETUP_URL}><Download className="w-4 h-4" /> ดาวน์โหลด SafeBrowserSetup.exe</a>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <a href={SAFE_BROWSER_RELEASE_URL} target="_blank" rel="noreferrer">หน้ารุ่นล่าสุด <ExternalLink className="w-4 h-4" /></a>
            </Button>
          </div>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li className="flex gap-2"><Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />โหมดคีออสเต็มจอ ปิดปุ่มลัดสลับหน้าต่าง และเปิดใหม่เองถ้าถูกปิด</li>
            <li className="flex gap-2"><MonitorSmartphone className="w-4 h-4 text-primary shrink-0 mt-0.5" />เปิดอัตโนมัติทุกครั้งที่เข้า Windows เริ่มที่หน้าแรกเว็บโรงเรียน</li>
            <li className="flex gap-2"><QrCode className="w-4 h-4 text-primary shrink-0 mt-0.5" />ออกจากโปรแกรมได้เฉพาะเมื่อสแกน QR บัตรผู้ดูแลระบบหรือบุคลากร</li>
            <li className="flex gap-2"><Power className="w-4 h-4 text-primary shrink-0 mt-0.5" />ปิด/รีสตาร์ทเครื่องด้วยบัตร หรือสั่งปิดจากหน้า FaceGate → เครื่องสแกน</li>
          </ul>
          <ol className="text-sm space-y-2 list-decimal pl-5">
            <li>สร้างรหัสเครื่อง (Device Key) ที่หน้าตั้งค่าเครื่องสแกนในระบบหลังบ้าน</li>
            <li>เปิด SafeBrowserSetup.exe ด้วยสิทธิ์ผู้ดูแลเครื่อง แล้วใส่รหัสเครื่อง</li>
            <li>ออกจากโปรแกรม: กดปุ่ม ⏻ มุมล่างซ้าย (หรือ Ctrl+Shift+Q) แล้วสแกนบัตรบุคลากร</li>
          </ol>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            การออกจากโปรแกรมต้องใช้อินเทอร์เน็ตเพื่อตรวจบัตรกับระบบ · Ctrl+Alt+Del ไม่มีโปรแกรมใดปิดได้ ควรให้นักเรียนใช้บัญชี Windows แบบผู้ใช้ทั่วไป
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 pt-2">
        <Puzzle className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">ส่วนขยาย Chrome (ใช้แยกกับ Chrome ปกติ)</h2>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">ดาวน์โหลดและติดตั้ง</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={download} size="lg" className="gap-2">
              <Download className="w-4 h-4" /> ดาวน์โหลด school-safe-browser.zip
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <a href={GITHUB_EXTENSION_DOWNLOAD_URL} download="school-safe-browser.zip">
                <Download className="w-4 h-4" /> ดาวน์โหลดจาก GitHub (สำรอง)
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            หากดาวน์โหลดจากเว็บนี้ไม่ได้ ใช้ปุ่ม GitHub สำรอง — ไฟล์ชุดเดียวกันและอัปเดตพร้อมกันทุกครั้ง (
            <a
              href={GITHUB_EXTENSION_RELEASE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline inline-flex items-center gap-1"
            >
              หน้า Release <ExternalLink className="w-3 h-3" />
            </a>
            )
          </p>
          <ol className="text-sm space-y-2 list-decimal pl-5">
            <li>แตกไฟล์ zip ที่ดาวน์โหลด</li>
            <li>เปิด <code className="px-1 bg-muted rounded">chrome://extensions</code></li>
            <li>เปิด <b>Developer mode</b> (มุมบนขวา)</li>
            <li>คลิก <b>Load unpacked</b> เลือกโฟลเดอร์ที่แตกไว้</li>
            <li>เข้าเว็บระบบโรงเรียนเพื่อเชื่อมต่อบัญชีอัตโนมัติ</li>
          </ol>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground flex gap-2">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
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
            <li>ตัวกรองคำต้องห้าม (keyword) — พนัน / สื่อลามก / ยาเสพติด / ความรุนแรง ทั้งใน URL คำค้นหา และเนื้อหาหน้าเว็บ</li>
            <li>บล็อกตามช่วงเวลา (เช่น โซเชียลช่วงคาบเรียน) + บังคับ login ก่อนใช้อินเทอร์เน็ต</li>
            <li>แถบเครื่องมือลอย: 🏠 กลับสู่ระบบ / ✕ ปิดแท็บ ทุกหน้าเว็บ</li>
            <li>ฟีเจอร์ทั้งหมดนี้มีอยู่ในโปรแกรม BNG Safe Browser สำหรับ Windows แล้ว</li>
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
