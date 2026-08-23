import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { exportDMC, exportSGS, exportObecZip } from "@/lib/obecExport";
import { exportSchoolMisExcel } from "@/lib/schoolMisExport";
import { Download, FileSpreadsheet, Package, School, Users, GraduationCap, Database, RefreshCw, FileArchive, Printer } from "lucide-react";

function getBrandingFallback() {
  try {
    const raw = localStorage.getItem("cms_branding_cache");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export default function ObecHubPage(){
  const { lang } = useLanguage();
  const { schoolName, schoolLogo, appName } = useSystemSettings();
  const brandingCache: any = getBrandingFallback();
  const isTh = lang === "th";

  const schoolInfo = useMemo(() => {
    const b = brandingCache || {};
    return {
      name: schoolName || b.name || b.schoolName || "โรงเรียนบ้านหนองเงือก",
      logo: schoolLogo || b.logo || "",
      code: b.schoolCode || b.code || b.school_code || "",
      address: b.schoolAddress || b.address || "",
      phone: b.schoolPhone || b.phone || "",
      director: b.directorName || b.director || "นายเกษม ใจกระเสน",
      shortName: b.shortName || b.schoolShortName || "",
    };
  }, [schoolName, schoolLogo, brandingCache]);

  const { data: students = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["obec_hub_students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").limit(200);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter((s:any)=> s.status === "active" || !s.status).length;
    const byGradeMap = new Map<string, number>();
    const byClassroomMap = new Map<string, number>();
    let male = 0, female = 0;
    for (const s of students as any[]) {
      const grade = s.grade_level || s.classrooms?.grade_level || "ไม่ระบุ";
      byGradeMap.set(grade, (byGradeMap.get(grade)||0)+1);
      const room = s.classroom || s.classrooms?.name || s.classroom_name || "—";
      const key = `${grade} ${room}`.trim();
      byClassroomMap.set(key, (byClassroomMap.get(key)||0)+1);
      const prefix = s.prefix || "";
      const gender = s.gender || "";
      if (gender === "ชาย" || gender === "male" || gender === "M" || prefix.includes("ด.ช") || prefix === "นาย") male++;
      else if (gender === "หญิง" || gender === "female" || gender === "F" || prefix.includes("ด.ญ") || prefix.includes("นางสาว")) female++;
    }
    const byGrade = Array.from(byGradeMap.entries()).sort((a,b)=> a[0].localeCompare(b[0],"th"));
    const byClassroom = Array.from(byClassroomMap.entries()).sort((a,b)=> b[1]-a[1]).slice(0,8);
    return { total, active, byGrade, byClassroom, male, female };
  }, [students]);

  const handleExportDmc = () => {
    if (!students.length) { toast.error(isTh ? "ไม่มีข้อมูลนักเรียนให้ส่งออก" : "No students to export"); return; }
    exportDMC(students);
    toast.success(isTh ? `ส่งออก DMC สำเร็จ ${students.length} คน` : `DMC exported ${students.length} students`);
  };

  const handleExportSgs = () => {
    if (!students.length) { toast.error(isTh ? "ไม่มีข้อมูลนักเรียน" : "No students"); return; }
    const rows = (students as any[]).map((s)=> ({
      year: String(new Date().getFullYear() + 543),
      term: "1",
      subjectCode: s.subject_code || "0000",
      subjectName: s.subject_name || "-",
      credit: 1,
      studentCode: s.student_code,
      studentName: `${s.prefix||""}${s.first_name||""} ${s.last_name||""}`.trim(),
      fullScore: 100,
      score: s.score ?? 0,
      grade: s.grade ?? "",
    }));
    exportSGS(rows);
    toast.success(isTh ? `ส่งออก SGS สำเร็จ ${rows.length} รายการ` : `SGS exported ${rows.length} rows`);
  };

  const handleExportSchoolMis = () => {
    if (!students.length) { toast.error(isTh ? "ไม่มีข้อมูลนักเรียน" : "No students"); return; }
    const rows = (students as any[]).map((s)=> ({
      schoolCode: s.school_code || schoolInfo.code || "",
      year: String(new Date().getFullYear() + 543),
      term: "1",
      subjectCode: "DMC",
      subjectName: isTh ? "ข้อมูลนักเรียน" : "Student Data",
      credit: 1,
      studentCode: s.student_code,
      studentName: `${s.prefix||""}${s.first_name||""} ${s.last_name||""}`.trim(),
      fullScore: 100,
      score: 0,
      classroom: s.classroom || s.grade_level || "",
    }));
    exportSchoolMisExcel(rows);
    toast.success(isTh ? `ส่งออก SchoolMIS สำเร็จ ${rows.length} คน` : `SchoolMIS exported ${rows.length} students`);
  };

  const handleExportZip = async () => {
    if (!students.length) { toast.error(isTh ? "ไม่มีข้อมูลนักเรียน" : "No students"); return; }
    const schoolInfoPayload: Record<string,string> = {
      school_name: schoolInfo.name,
      school_code: schoolInfo.code,
      school_logo: schoolInfo.logo,
      address: schoolInfo.address,
      phone: schoolInfo.phone,
      director: schoolInfo.director,
      app_name: appName,
      export_at: new Date().toISOString(),
      total_students: String(students.length),
    };
    await exportObecZip({ dmcStudents: students, schoolInfo: schoolInfoPayload });
    toast.success(isTh ? "ส่งออก OBEC ZIP สำเร็จ" : "OBEC ZIP exported");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <School className="h-7 w-7 text-primary" />
            {isTh ? "OBEC Hub — เชื่อม สพฐ. ไร้รอยต่อ" : "OBEC Hub — Seamless MOE Integration"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isTh ? "ส่งออก DMC / SGS / SchoolMIS / ปพ. + ยิง API สพฐ. อัตโนมัติเมื่อเขตเปิดให้" : "Export DMC / SGS / SchoolMIS / Por + auto-push to OBEC API when enabled"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 px-3 py-1">
            <Database className="h-3.5 w-3.5" />
            {isLoading ? (isTh ? "กำลังโหลด..." : "Loading...") : `${students.length} ${isTh ? "คน (limit 200)" : "students (limit 200)"}`}
          </Badge>
          <Button variant="outline" size="sm" onClick={()=> refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {isTh ? "รีเฟรช" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* School info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-4">
          {schoolInfo.logo ? (
            <img src={schoolInfo.logo} alt="logo" className="h-14 w-14 rounded-lg object-contain border bg-white p-1" onError={(e)=> (e.currentTarget.style.display="none")} />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center"><School className="h-7 w-7 text-primary" /></div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold leading-tight truncate">{schoolInfo.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {schoolInfo.code ? `${isTh ? "รหัสโรงเรียน" : "School code"}: ${schoolInfo.code} · ` : ""}
              {schoolInfo.address || (isTh ? "ไม่ระบุที่อยู่" : "No address")} {schoolInfo.phone ? `· ${schoolInfo.phone}` : ""}
            </div>
            <div className="text-xs text-muted-foreground">{isTh ? "ผู้อำนวยการ" : "Director"}: {schoolInfo.director} · {appName}</div>
          </div>
          <Badge variant="secondary" className="hidden sm:inline-flex gap-1"><GraduationCap className="h-3.5 w-3.5" />{isTh ? "เชื่อม สพฐ." : "OBEC Ready"}</Badge>
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" />{isTh ? "นักเรียนทั้งหมด" : "Total students"}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isLoading ? "—" : stats.total}</div>
            <p className="text-xs text-muted-foreground">{isTh ? "ดึงสูงสุด 200 คน" : "Fetched up to 200"} · {isTh ? "ใช้งาน" : "Active"}: {stats.active}</p>
            {isError && <p className="text-xs text-destructive mt-1 truncate">{(error as any)?.message || "load failed"}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><GraduationCap className="h-4 w-4" />{isTh ? "แยกตามระดับชั้น" : "By grade"}</CardTitle></CardHeader>
          <CardContent>
            {stats.byGrade.length ? (
              <div className="flex flex-wrap gap-1.5">
                {stats.byGrade.map(([g,c])=> (
                  <Badge key={g} variant="secondary" className="font-normal">{g}: {c}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{isLoading ? (isTh ? "กำลังโหลด..." : "Loading...") : (isTh ? "ไม่มีข้อมูล" : "No data")}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">{isTh ? "นับจาก grade_level" : "Grouped by grade_level"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" />{isTh ? "ชาย / หญิง" : "Male / Female"}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.male} <span className="text-sm font-normal text-muted-foreground">/ {stats.female}</span></div>
            <p className="text-xs text-muted-foreground">{isTh ? "คำนวณจาก prefix/gender" : "From prefix/gender"}</p>
            {stats.total > 0 && <p className="text-xs text-muted-foreground">{isTh ? "ไม่ระบุ" : "Unspecified"}: {stats.total - stats.male - stats.female}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><FileArchive className="h-4 w-4" />{isTh ? "ห้องเรียนยอดนิยม" : "Top classrooms"}</CardTitle></CardHeader>
          <CardContent>
            {stats.byClassroom.length ? (
              <div className="space-y-1">
                {stats.byClassroom.map(([k,c])=> (
                  <div key={k} className="flex justify-between text-xs"><span className="truncate pr-2">{k || "—"}</span><span className="font-medium">{c}</span></div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{isTh ? "ไม่มีข้อมูลห้อง" : "No classroom data"}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Export actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" />DMC</CardTitle><CardDescription>{isTh ? "25+ ฟิลด์ตามสเปค Data Management Center" : "25+ fields OBEC DMC spec"}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{isTh ? `พร้อมส่งออก ${students.length} คน` : `Ready to export ${students.length} students`}</p>
            <Button onClick={handleExportDmc} disabled={isLoading || !students.length} className="w-full gap-2"><Download className="h-4 w-4" />{isTh ? `Export DMC (${students.length})` : `Export DMC (${students.length})`}</Button>
            <p className="text-[11px] text-muted-foreground">{isTh ? "ไฟล์: dmc_students.xlsx" : "File: dmc_students.xlsx"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-emerald-600" />SGS</CardTitle><CardDescription>{isTh ? "ผลการเรียนตามเทมเพลต สพฐ." : "Grades per OBEC SGS template"}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{isTh ? `แปลง ${students.length} คนเป็นแถว SGS` : `Map ${students.length} students to SGS rows`}</p>
            <Button onClick={handleExportSgs} disabled={isLoading || !students.length} variant="secondary" className="w-full gap-2"><Download className="h-4 w-4" />Export SGS</Button>
            <p className="text-[11px] text-muted-foreground">sgs_grades.xlsx</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-blue-600" />SchoolMIS</CardTitle><CardDescription>{isTh ? "8 คอลัมน์ตามเทมเพลต สพฐ." : "8 columns OBEC SchoolMIS template"}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{isTh ? `ใช้ ${students.length} คนสร้าง SchoolMIS` : `Build SchoolMIS from ${students.length} students`}</p>
            <Button onClick={handleExportSchoolMis} disabled={isLoading || !students.length} className="w-full gap-2 bg-blue-600 hover:bg-blue-700"><Download className="h-4 w-4" />Export SchoolMIS</Button>
            <p className="text-[11px] text-muted-foreground">schoolmis_grades.xlsx</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5 text-amber-600" />ปพ.5</CardTitle><CardDescription>{isTh ? "พิมพ์ ปพ.1-6" : "Print Por 1-6"}</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">{isTh ? "ดูตัวอย่างก่อนพิมพ์เอกสารราชการ" : "Preview before printing official docs"}</p>
            <Button variant="outline" className="w-full" onClick={()=> window.location.href="/preview-gov"}>{isTh ? "พิมพ์ ปพ.1-6 (ดู /preview-gov)" : "Print Por 1-6 (see /preview-gov)"}</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-5 w-5" />{isTh ? "OBEC ZIP — แพ็ครวมส่ง สพฐ." : "OBEC ZIP — All-in-one for OBEC"}</CardTitle><CardDescription>{isTh ? "รวม DMC + School info เป็น ZIP เดียวพร้อมอัปโหลดพอร์ทัล สพฐ." : "Bundle DMC + school info into one ZIP for OBEC portal"}</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={handleExportZip} disabled={isLoading || !students.length} size="lg" className="gap-2"><FileArchive className="h-4 w-4" />{isTh ? `Export OBEC ZIP (${students.length} คน)` : `Export OBEC ZIP (${students.length})`}</Button>
          <span className="text-xs text-muted-foreground">obec_export.zip · {isTh ? "มี" : "contains"} dmc_students.xlsx + school_info.json</span>
        </CardContent>
      </Card>

      {/* API endpoint display — keep existing */}
      <Card className="border-dashed">
        <CardHeader className="pb-2"><CardTitle className="text-sm">{isTh ? "API auto-push" : "API auto-push"}</CardTitle><CardDescription>{isTh ? "endpoint สพฐ. (DMC API / SFTP)" : "OBEC endpoint (DMC API / SFTP)"}</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-muted p-3 font-mono text-xs break-all">
            {isTh ? "POST https://api.obec.go.th/dmc/v1/import — รอเขตเปิดให้ (ตอนนี้กด Export แล้วอัปโหลดพอร์ทัล สพฐ. ได้ทันที)" : "POST https://api.obec.go.th/dmc/v1/import — awaiting district enablement (export & upload to OBEC portal now)"}
          </div>
          <p className="text-xs text-muted-foreground">
            {isTh ? "API auto-push จะใส่ endpoint สพฐ. (DMC API / SFTP) เมื่อ สพป. แจ้ง — ตอนนี้กด Export แล้วอัปโหลดพอร์ทัล สพฐ. ได้ทันที" : "Auto-push will be configured with OBEC DMC API / SFTP endpoint when district notifies — you can export & upload manually for now."}
            {" · "}
            <span className="font-medium">{isTh ? `ข้อมูลพร้อมส่ง: ${students.length} คน` : `Ready: ${students.length} students`}</span>
            {schoolInfo.code && <span> · {isTh ? "รหัสโรงเรียน" : "School code"}: {schoolInfo.code}</span>}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
