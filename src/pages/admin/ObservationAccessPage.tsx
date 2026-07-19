import { useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Eye,
  Copy,
  Download,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Mail,
  Link as LinkIcon,
  QrCode,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { swal } from "@/lib/swal";

const DEFAULT_EMAIL = "observer@school.com";
const DEFAULT_PASSWORD = "Observer@2026";

export default function ObservationAccessPage() {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const qrRef = useRef<HTMLDivElement>(null);

  const loginUrl = useMemo(() => {
    const base = window.location.origin;
    return `${base}/auth?email=${encodeURIComponent(email)}`;
  }, [email]);

  const shareText = useMemo(
    () =>
      [
        "🔎 บัญชีสำหรับผู้สังเกตการณ์ระบบ (ศน. / ผู้ประเมิน)",
        `เว็บไซต์: ${window.location.origin}`,
        `Email: ${email}`,
        `Password: ${password}`,
        "",
        "หมายเหตุ: บัญชีนี้อ่านอย่างเดียว (Read-only) ไม่สามารถแก้ไข/ลบข้อมูลได้",
      ].join("\n"),
    [email, password]
  );

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      swal.toast("success", `คัดลอก${label}แล้ว`);
    } catch {
      swal.error("คัดลอกไม่สำเร็จ", "กรุณาคัดลอกด้วยตนเอง");
    }
  };

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "observer-access-qr.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const canView: string[] = [
    "แดชบอร์ดภาพรวมโรงเรียน / รายงานผู้บริหาร",
    "ตารางเรียน / ตารางสอน / ตารางเวรครู",
    "SAR, มาตรฐาน, แผนกลยุทธ์, PDCA, ID Plan",
    "โครงการฮับ (Hub Projects) และการติดตามงบประมาณระดับสรุป",
    "รายงานการเรียน–พฤติกรรม–สุขภาพ ระดับสรุป/ห้องเรียน",
    "ปฏิทินวิชาการ ข่าวสาร ประกาศโรงเรียน",
    "หน้าตรวจสอบระบบและเมนูรายงานต่างๆ (อ่านอย่างเดียว)",
  ];

  const cannotDo: string[] = [
    "ไม่สามารถเพิ่ม/แก้ไข/ลบข้อมูลใดๆ ในระบบ (Read-only ทั้งระบบ)",
    "ไม่สามารถส่งข้อความ / อีเมล / แจ้งเตือน แทนโรงเรียน",
    "ไม่สามารถอัปโหลด ดาวน์โหลด หรือลบไฟล์ในคลังเอกสาร (Vault/Drive)",
    "ไม่สามารถดู เลขบัตรประชาชน, เบอร์โทร, ที่อยู่ ของบุคคลรายบุคคลแบบ raw",
    "ไม่สามารถดูข้อมูลสุขภาพเชิงลึกรายบุคคล (SDQ/สุขภาพ) — เห็นเฉพาะสรุปรวม",
    "ไม่สามารถเข้าถึงห้องแชท / บันทึกการสนทนาส่วนตัว",
    "ไม่สามารถใช้เมนู Admin (จัดการผู้ใช้, Secrets, API, Kiosk)",
  ];

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
          <Eye className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">บัญชีสำหรับผู้สังเกตการณ์ระบบ</h1>
          <p className="text-sm text-muted-foreground">
            ใช้แชร์ให้ ศึกษานิเทศก์ / ผู้ประเมิน / คณะกรรมการภายนอก เข้ามาดูระบบแบบอ่านอย่างเดียว
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>วิธีใช้งาน</AlertTitle>
        <AlertDescription className="space-y-1 text-sm">
          <p>1. แชร์ QR Code หรือส่งข้อความด้านล่างให้ผู้สังเกตการณ์</p>
          <p>2. ผู้สังเกตการณ์สแกน QR หรือกดลิงก์ → เข้าสู่ระบบด้วย Email/Password ที่แสดง</p>
          <p>3. ระบบจะเปิดโหมด <b>Read-only</b> อัตโนมัติ พร้อมแถบสีเหลืองแจ้งเตือนด้านบน</p>
          <p>4. เมื่อเสร็จการตรวจ สามารถกดเปลี่ยนรหัสผ่านใหม่ในหน้านี้เพื่อความปลอดภัย</p>
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Credentials */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              ข้อมูลเข้าสู่ระบบ
            </CardTitle>
            <CardDescription>บัญชีเดียวสำหรับผู้สังเกตการณ์ทุกคน</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Email
              </Label>
              <div className="flex gap-2">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} readOnly />
                <Button variant="outline" size="icon" onClick={() => copy(email, "Email")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Password
              </Label>
              <div className="flex gap-2">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button variant="outline" size="icon" onClick={() => copy(password, "Password")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                รหัสผ่านนี้ใช้แชร์อย่างเดียว หากต้องการเปลี่ยน กรุณาเปลี่ยนในหน้า “ทะเบียนผู้ใช้งาน” ด้วย
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" /> ลิงก์เข้าสู่ระบบ
              </Label>
              <div className="flex gap-2">
                <Input value={loginUrl} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(loginUrl, "ลิงก์")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={() => copy(shareText, "ข้อความแชร์")}>
              <Copy className="h-4 w-4 mr-2" /> คัดลอกข้อความแชร์ทั้งหมด
            </Button>
          </CardContent>
        </Card>

        {/* QR Code */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              QR Code สำหรับแชร์
            </CardTitle>
            <CardDescription>สแกนเพื่อเปิดหน้าเข้าสู่ระบบพร้อมกรอก Email อัตโนมัติ</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div ref={qrRef} className="p-4 bg-white rounded-xl border">
              <QRCodeSVG value={loginUrl} size={220} includeMargin level="M" />
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {loginUrl}
            </Badge>
            <Button variant="outline" onClick={downloadQR} className="w-full">
              <Download className="h-4 w-4 mr-2" /> ดาวน์โหลด QR (.svg)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* PDPA */}
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            หมายเหตุ PDPA — ขอบเขตข้อมูลที่ผู้สังเกตการณ์เข้าถึงได้
          </CardTitle>
          <CardDescription>
            บัญชี Observer ถูกจำกัดสิทธิ์ทั้งฝั่ง Client (Read-only Guard) และการแสดงผล
            ตามหลัก <b>Data Minimization</b> ของ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <b className="text-sm">สิ่งที่ดูได้</b>
            </div>
            <ul className="space-y-2 text-sm">
              {canView.map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="h-4 w-4 text-rose-500" />
              <b className="text-sm">สิ่งที่ทำไม่ได้ / ไม่เห็น</b>
            </div>
            <ul className="space-y-2 text-sm">
              {cannotDo.map((t) => (
                <li key={t} className="flex gap-2">
                  <XCircle className="h-4 w-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Alert className="border-primary/30 bg-primary/5">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <AlertTitle>การป้องกันในระบบ</AlertTitle>
        <AlertDescription className="text-sm space-y-1">
          <p>• Read-only Guard ดัก <code>fetch()</code> ทุกคำสั่ง <b>POST/PUT/PATCH/DELETE</b> ที่ยิงไป Cloud Backend และแสดง SweetAlert ภาษาไทย</p>
          <p>• Row-Level Security (RLS) ในฐานข้อมูลป้องกันการเข้าถึงข้อมูลนอกโรงเรียน</p>
          <p>• ทุก session ของ observer จะถูกบันทึกใน <code>audit_logs</code> เพื่อความโปร่งใส</p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
