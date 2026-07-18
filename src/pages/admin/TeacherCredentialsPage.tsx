import { useState } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Download, KeyRound, Users, FileText, ShieldAlert, Loader2 } from "lucide-react";
import { PASSWORD_RULES_DESC } from "@/lib/passwordPolicy";
import { confirmAction } from "@/lib/confirmAction";

type ExportRow = {
  user_id: string;
  email: string;
  employee_code: string;
  full_name: string;
  role: string;
  position: string;
  position_level: string;
  academic_standing: string;
  subject_group: string;
  department: string;
  phone: string;
};

type ResetRow = {
  user_id: string;
  email: string;
  employee_code: string;
  name: string;
  position?: string;
  department?: string;
  temp_password?: string;
  success: boolean;
  error?: string;
};

function csvEscape(v: string): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | undefined | null)[][]) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) lines.push(r.map((v) => csvEscape(v == null ? "" : String(v))).join(","));
  // Add BOM so Excel opens Thai correctly
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TeacherCredentialsPage() {
  const [includeDirectors, setIncludeDirectors] = useState(false);
  const [tempPrefix, setTempPrefix] = useState("Teacher@");
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastReset, setLastReset] = useState<ResetRow[] | null>(null);

  const exportTeacherList = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list_teachers_for_export", include_directors: includeDirectors },
      });
      if (error) throw error;
      const rows = (data?.results ?? []) as ExportRow[];
      if (rows.length === 0) { toast.warning("ไม่พบรายชื่อครู"); return; }
      downloadCsv(
        `teachers_${todayBangkok()}.csv`,
        ["รหัสบุคลากร", "อีเมล (Username)", "คำนำหน้า + ชื่อ-สกุล", "บทบาท", "ตำแหน่ง", "วิทยฐานะ", "กลุ่มสาระ", "ฝ่าย", "เบอร์โทร"],
        rows.map((r) => [
          r.employee_code, r.email, r.full_name, r.role,
          r.position, r.position_level || r.academic_standing || "", r.subject_group, r.department, r.phone,
        ]),
      );
      toast.success(`ส่งออก ${rows.length} รายการสำเร็จ`);
    } catch (e: any) {
      toast.error(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const runBulkReset = async () => {
    setResetting(true);
    setConfirmOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "bulk_reset_teachers",
          include_directors: includeDirectors,
          temp_prefix: tempPrefix || "Teacher@",
        },
      });
      if (error) throw error;
      const rows = (data?.results ?? []) as ResetRow[];
      setLastReset(rows);
      const ok = rows.filter((r) => r.success).length;
      const fail = rows.length - ok;
      toast.success(`รีเซ็ตสำเร็จ ${ok} / ${rows.length} (ล้มเหลว ${fail})`);
      // Auto-download CSV with temp credentials
      const okRows = rows.filter((r) => r.success);
      if (okRows.length > 0) {
        downloadCsv(
          `teacher_temp_passwords_${todayBangkok()}.csv`,
          ["รหัสบุคลากร", "ชื่อ-สกุล", "ตำแหน่ง", "ฝ่าย", "อีเมล (Username)", "รหัสผ่านชั่วคราว"],
          okRows.map((r) => [r.employee_code, r.name, r.position || "", r.department || "", r.email, r.temp_password || ""]),
        );
      }
    } catch (e: any) {
      toast.error(e?.message || "Bulk reset failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-primary" />
          จัดการบัญชี & รหัสผ่านครู
        </h1>
        <p className="text-sm text-muted-foreground">
          ส่งออกรายชื่อ + อีเมล/Username สำหรับเข้าระบบ และรีเซ็ตรหัสผ่านชั่วคราวให้ครูทุกคน
        </p>
      </div>

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> ขอบเขต
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox id="incdir" checked={includeDirectors} onCheckedChange={(v) => setIncludeDirectors(!!v)} />
            <Label htmlFor="incdir" className="cursor-pointer">รวมผู้บริหาร (director) ด้วย</Label>
          </div>
        </CardContent>
      </Card>

      {/* Action 1: CSV */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> 1) ส่งออกรายชื่อครู + Username (CSV)
          </CardTitle>
          <CardDescription>
            ไม่กระทบรหัสผ่านเดิม — ใช้สำหรับตรวจสอบ/แจกอีเมลเข้าระบบให้ครู
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportTeacherList} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            ดาวน์โหลด CSV
          </Button>
        </CardContent>
      </Card>

      {/* Action 2: Bulk reset */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-4 h-4" /> 2) Bulk Reset รหัสผ่านชั่วคราว
          </CardTitle>
          <CardDescription>
            ทุกบัญชีจะถูกตั้งรหัสผ่านใหม่ในรูปแบบ <code>{tempPrefix}&lt;รหัสบุคลากร&gt;&lt;2-digit&gt;</code> และครูทุกคนจะถูกบังคับให้ <b>เปลี่ยนรหัสผ่านเมื่อ login ครั้งถัดไป</b>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">คำนำหน้า (Prefix) ของรหัสชั่วคราว</Label>
              <Input value={tempPrefix} onChange={(e) => setTempPrefix(e.target.value)} placeholder="Teacher@" />
              <p className="text-[11px] text-muted-foreground mt-1">
                ตัวอย่าง: <code>{tempPrefix}t0001<span className="opacity-60">42</span></code>
              </p>
            </div>
          </div>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={resetting}>
            {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
            รีเซ็ตรหัสผ่านครูทั้งหมด
          </Button>
        </CardContent>
      </Card>

      {/* Action 3: Bulk reset students to fixed password */}
      <Card className="border-warning/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-warning">
            <KeyRound className="w-4 h-4" /> 3) รีเซ็ตรหัสผ่าน <b>นักเรียนทุกคน</b> เป็นรหัสเดียวกัน
          </CardTitle>
          <CardDescription>
            ตั้งรหัสผ่านนักเรียนทั้งหมดเป็น <code>School@12345</code> (ไม่บังคับเปลี่ยนตอน login)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            disabled={resetting}
            onClick={async () => {
              if (!(await confirmAction({ title: "ยืนยันตั้งรหัสผ่านนักเรียนทุกคนเป็น School@12345?", danger: true }))) return;
              setResetting(true);
              try {
                const { data, error } = await supabase.functions.invoke("manage-users", {
                  body: { action: "bulk_reset_students", new_password: "School@12345", force_change: false },
                });
                if (error) throw error;
                toast.success(`สำเร็จ ${data?.ok ?? 0}/${data?.total ?? 0} (ล้มเหลว ${data?.failed ?? 0})`);
              } catch (e: any) {
                toast.error(e?.message || "Bulk reset students failed");
              } finally {
                setResetting(false);
              }
            }}
          >
            {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
            ตั้งรหัสนักเรียนทั้งหมด = School@12345
          </Button>
        </CardContent>
      </Card>

      {/* Action 4: Force sign-out all users (force re-login) */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-4 h-4" /> 4) ตัดการเชื่อมต่อผู้ใช้ทั้งหมด (Force Logout)
          </CardTitle>
          <CardDescription>
            บังคับ logout ทุกบัญชี (ยกเว้น admin) เพื่อให้ทุกคน login ใหม่ — ใช้แก้ปัญหา session ค้าง / ระบบโหลดช้า
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            disabled={resetting}
            onClick={async () => {
              if (!(await confirmAction({ title: "ยืนยันตัดการเชื่อมต่อผู้ใช้ทั้งหมด (ยกเว้น admin)? ทุกคนจะต้อง login ใหม่", danger: true }))) return;
              setResetting(true);
              try {
                const { data, error } = await supabase.functions.invoke("manage-users", {
                  body: { action: "sign_out_all_users", exclude_admins: true },
                });
                if (error) throw error;
                toast.success(`ตัดการเชื่อมต่อสำเร็จ ${data?.ok ?? 0}/${data?.total ?? 0} (ล้มเหลว ${data?.failed ?? 0})`);
              } catch (e: any) {
                toast.error(e?.message || "Sign-out all failed");
              } finally {
                setResetting(false);
              }
            }}
          >
            {resetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
            ตัดการเชื่อมต่อผู้ใช้ทั้งหมด
          </Button>
        </CardContent>
      </Card>



      {/* Password policy explainer */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            🔐 เกณฑ์การตั้งรหัสผ่านใหม่ (ครูจะเห็นในหน้าตั้งรหัส)
          </CardTitle>
          <CardDescription>เมื่อครู login ครั้งแรกด้วยรหัสชั่วคราว ระบบจะบังคับให้ตั้งรหัสผ่านใหม่ตามเกณฑ์นี้</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1.5 list-disc pl-5">
            {PASSWORD_RULES_DESC.th.map((r, i) => (<li key={i}>{r}</li>))}
          </ul>
        </CardContent>
      </Card>

      {/* Last reset results */}
      {lastReset && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ผลการรีเซ็ตล่าสุด ({lastReset.length} รายการ)</CardTitle>
            <CardDescription>
              ไฟล์ CSV รหัสผ่านชั่วคราวถูกดาวน์โหลดอัตโนมัติแล้ว — เก็บไว้ในที่ปลอดภัย และลบเมื่อแจกครูครบ
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัสบุคลากร</TableHead>
                    <TableHead>ชื่อ-สกุล</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>รหัสชั่วคราว</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastReset.slice(0, 200).map((r) => (
                    <TableRow key={r.user_id}>
                      <TableCell className="font-mono text-xs">{r.employee_code || "—"}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-xs">{r.email}</TableCell>
                      <TableCell className="font-mono text-xs">{r.temp_password || "—"}</TableCell>
                      <TableCell>
                        {r.success
                          ? <Badge className="bg-success-soft text-success">สำเร็จ</Badge>
                          : <Badge className="bg-danger-soft text-danger" title={r.error}>ล้มเหลว</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการรีเซ็ตรหัสผ่านครูทั้งหมด?</AlertDialogTitle>
            <AlertDialogDescription>
              การกระทำนี้จะตั้งรหัสผ่านใหม่ให้ครู{includeDirectors ? "และผู้บริหาร" : ""}ทุกคน
              และทำให้ครูไม่สามารถ login ด้วยรหัสเดิมได้อีก ระบบจะดาวน์โหลด CSV รหัสชั่วคราวให้อัตโนมัติ
              <br /><br />
              <b>ทำต่อก็ต่อเมื่อพร้อมแจกรหัสใหม่ให้ครูแล้วเท่านั้น</b>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkReset} className="bg-destructive hover:bg-destructive/90">
              ยืนยัน Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
