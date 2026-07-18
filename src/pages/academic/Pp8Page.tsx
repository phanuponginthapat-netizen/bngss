import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Printer, FolderOpen, Search } from "lucide-react";
import { formatFullName } from "@/lib/nameFormat";
import { formatDateBE } from "@/lib/dateBE";
import { ExportMenu } from "@/components/academic/ExportMenu";
import { useSchoolInfo } from "@/components/documents/DocumentHeader";
import { printPP8, exportPP8Sgs, exportPP8SchoolMis } from "@/lib/exporters/pp8Cumulative";

const Pp8Page = () => {
  const { lang } = useLanguage();
  const [searchCode, setSearchCode] = useState("");
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [behavior, setBehavior] = useState<any[]>([]);
  const [homeVisits, setHomeVisits] = useState<any[]>([]);
  const [healthRecords, setHealthRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const L = (th: string, en: string) => lang === "th" ? th : en;

  const handleSearch = async () => {
    if (!searchCode.trim()) return;
    setLoading(true);

    const { data: s } = await supabase
      .from("students")
      .select("*, classrooms:classroom_id(name, grade_level)")
      .eq("student_code", searchCode.trim())
      .maybeSingle();

    if (!s) {
      setStudent(null);
      setLoading(false);
      return;
    }
    setStudent(s);

    // Fetch related data in parallel
    const [attRes, behRes, hvRes, hrRes] = await Promise.all([
      supabase.from("attendance").select("*").eq("student_id", s.id).order("attendance_date", { ascending: false }).limit(100),
      supabase.from("behavior_records").select("*").eq("student_id", s.id).order("record_date", { ascending: false }).limit(50),
      supabase.from("home_visits").select("*").eq("student_id", s.id).order("visit_date", { ascending: false }),
      supabase.from("health_records").select("*").eq("student_id", s.id).order("visit_date", { ascending: false }),
    ]);

    setAttendance(attRes.data || []);
    setBehavior(behRes.data || []);
    setHomeVisits(hvRes.data || []);
    setHealthRecords(hrRes.data || []);
    setLoading(false);
  };

  const attendanceSummary = {
    total: attendance.length,
    present: attendance.filter(a => a.status === "present").length,
    absent: attendance.filter(a => a.status === "absent").length,
    late: attendance.filter(a => a.status === "late").length,
    sick: attendance.filter(a => a.status === "sick").length,
  };

  const behaviorSummary = {
    positive: behavior.filter(b => b.behavior_type === "positive").reduce((s, b) => s + (b.points || 0), 0),
    negative: behavior.filter(b => b.behavior_type === "negative").reduce((s, b) => s + (b.points || 0), 0),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          {L("ปพ.8 (ระเบียนสะสม)", "PP.8 (Cumulative Record)")}
        </h1>
        {student && (
          <div className="flex gap-2">
            <Button onClick={() => window.print()} size="sm" variant="outline">
              <Printer className="w-4 h-4 mr-1" /> {L("พิมพ์", "Print")}
            </Button>
            <PP8ExportMenu student={student} attendanceSummary={attendanceSummary} behaviorSummary={behaviorSummary} />
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              value={searchCode}
              onChange={e => setSearchCode(e.target.value)}
              placeholder={L("กรอกรหัสนักเรียน", "Enter student code")}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="w-4 h-4 mr-1" /> {L("ค้นหา", "Search")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      )}

      {student && !loading && (
        <div className="space-y-4 print:space-y-2">
          {/* Student Info */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{L("ข้อมูลส่วนตัว", "Personal Information")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><Label className="text-muted-foreground">{L("ชื่อ-นามสกุล", "Name")}</Label><p className="whitespace-pre-wrap">{formatFullName(student.prefix, student.first_name, student.last_name)}</p></div>
                <div><Label className="text-muted-foreground">{L("รหัสนักเรียน", "Code")}</Label><p>{student.student_code}</p></div>
                <div><Label className="text-muted-foreground">{L("ชั้น/ห้อง", "Class")}</Label><p>{student.grade_level} {(student.classrooms as any)?.name || ""}</p></div>
                <div><Label className="text-muted-foreground">{L("เลขประจำตัวประชาชน", "ID Card")}</Label><p>{student.national_id || "-"}</p></div>
                <div><Label className="text-muted-foreground">{L("วันเกิด", "DOB")}</Label><p>{formatDateBE(student.date_of_birth) || "-"}</p></div>
                <div><Label className="text-muted-foreground">{L("เพศ", "Gender")}</Label><p>{student.gender || "-"}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Summary */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{L("สรุปการมาเรียน", "Attendance Summary")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2 text-center text-sm">
                <div className="p-2 rounded bg-muted"><p className="text-muted-foreground">{L("ทั้งหมด", "Total")}</p><p className="font-bold text-lg">{attendanceSummary.total}</p></div>
                <div className="p-2 rounded bg-success-soft"><p className="text-success">{L("มา", "Present")}</p><p className="font-bold text-lg text-success">{attendanceSummary.present}</p></div>
                <div className="p-2 rounded bg-danger-soft"><p className="text-danger">{L("ขาด", "Absent")}</p><p className="font-bold text-lg text-danger">{attendanceSummary.absent}</p></div>
                <div className="p-2 rounded bg-warning-soft"><p className="text-warning">{L("สาย", "Late")}</p><p className="font-bold text-lg text-warning">{attendanceSummary.late}</p></div>
                <div className="p-2 rounded bg-warning-soft"><p className="text-warning">{L("ป่วย", "Sick")}</p><p className="font-bold text-lg text-warning">{attendanceSummary.sick}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Behavior Summary */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{L("สรุปพฤติกรรม", "Behavior Summary")}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 rounded bg-success-soft">
                  <p className="text-success text-sm">{L("คะแนนดี", "Good Points")}</p>
                  <p className="font-bold text-2xl text-success">+{behaviorSummary.positive}</p>
                </div>
                <div className="p-3 rounded bg-danger-soft">
                  <p className="text-danger text-sm">{L("คะแนนไม่ดี", "Bad Points")}</p>
                  <p className="font-bold text-2xl text-danger">{behaviorSummary.negative}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Home Visits */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{L("บันทึกเยี่ยมบ้าน", "Home Visit Records")}</CardTitle></CardHeader>
            <CardContent>
              {homeVisits.length === 0 ? (
                <p className="text-sm text-muted-foreground">{L("ไม่มีข้อมูล", "No records")}</p>
              ) : (
                <div className="space-y-2">
                  {homeVisits.map(hv => (
                    <div key={hv.id} className="p-2 border rounded text-sm">
                      <p className="font-medium">{hv.visit_date} - {hv.visitor_name}</p>
                      <p className="text-muted-foreground">{L("สภาพบ้าน", "Home")}: {hv.home_condition || "-"} | {L("สภาพนักเรียน", "Student")}: {hv.student_condition || "-"}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Health Records */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{L("ประวัติสุขภาพ", "Health Records")}</CardTitle></CardHeader>
            <CardContent>
              {healthRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground">{L("ไม่มีข้อมูล", "No records")}</p>
              ) : (
                <div className="space-y-2">
                  {healthRecords.map(hr => (
                    <div key={hr.id} className="p-2 border rounded text-sm">
                      <p className="font-medium">{hr.visit_date}</p>
                      <p className="text-muted-foreground">{L("อาการ", "Symptoms")}: {hr.symptoms} | {L("การรักษา", "Treatment")}: {hr.treatment || "-"}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!student && !loading && searchCode && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">{L("ไม่พบนักเรียน", "Student not found")}</CardContent></Card>
      )}
    </div>
  );
};

const PP8ExportMenu = ({ student, attendanceSummary, behaviorSummary }: any) => {
  const schoolInfo = useSchoolInfo();
  const rec = {
    student_code: student.student_code,
    prefix: student.prefix, first_name: student.first_name, last_name: student.last_name,
    grade_level: student.grade_level, classroom: (student.classrooms as any)?.name || "",
    national_id: student.national_id, date_of_birth: student.date_of_birth, gender: student.gender,
    attendance: attendanceSummary, behavior: behaviorSummary,
  };
  const classroomName = `${student.grade_level || ""} ${(student.classrooms as any)?.name || ""}`.trim() || "class";
  return (
    <ExportMenu
      templateCode="pp8"
      templateTitle="ปพ.8 — ระเบียนสะสม"
      actions={[
        { key: "pdf", label: "PDF (พิมพ์)", icon: "pdf", onClick: () => printPP8(schoolInfo as any, [rec]) },
        { key: "sgs", label: "Excel (SGS)", icon: "xlsx", onClick: () => exportPP8Sgs(schoolInfo as any, classroomName, [rec]) },
        { key: "smis", label: "Excel (SchoolMIS)", icon: "xlsx", onClick: () => exportPP8SchoolMis(schoolInfo as any, classroomName, [rec]) },
      ]}
    />
  );
};

export default Pp8Page;
