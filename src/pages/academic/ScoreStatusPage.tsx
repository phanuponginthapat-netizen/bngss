import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, Eye, Download, Printer, FileSpreadsheet, RefreshCw, BellRing } from "lucide-react";
import { getCurrentPeriod } from "@/lib/ppImportChecks";
import { useUserRole } from "@/hooks/useUserRole";
import { swal } from "@/lib/swal";

type Status = "complete" | "partial" | "none";

const STATUS_META: Record<Status, { label: string; dot: string; badge: string }> = {
  complete: { label: "มีผลคะแนนแล้ว", dot: "bg-success", badge: "border-success/40 text-success" },
  partial: { label: "มีคะแนนบางส่วน", dot: "bg-warning", badge: "border-warning/40 text-warning" },
  none: { label: "ยังไม่มีผลคะแนน", dot: "bg-destructive", badge: "border-destructive/40 text-destructive" },
};

const StatusDot = ({ s }: { s: Status }) => (
  <span className={`inline-block h-3 w-3 rounded-full ${STATUS_META[s].dot} shadow-sm`} aria-hidden />
);

const yearsMatch = (be: number) => [be, be - 543];

export default function ScoreStatusPage() {
  const { userId, isAdmin, isDirector } = useUserRole();
  const [year, setYear] = useState<number | null>(null);
  const [semester, setSemester] = useState<string>("1");
  const [classroomId, setClassroomId] = useState<string>("");

  useEffect(() => {
    getCurrentPeriod().then((p) => {
      setYear(p.year);
      if (p.semester) setSemester(String(p.semester));
    });
  }, []);

  const { data: classrooms = [], isLoading: loadingRooms } = useQuery({
    queryKey: ["score-status-rooms", year],
    enabled: !!year,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classrooms")
        .select("id, name, grade_level, academic_year, homeroom_teacher_id, homeroom_teacher_2_id")
        .in("academic_year", yearsMatch(year!))
        .order("grade_level")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // ครูประจำชั้น → เลือกห้องของตนเองให้อัตโนมัติ
  const { data: myPersonnelId } = useQuery({
    queryKey: ["score-status-me", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_my_personnel" as any);
      return (Array.isArray(data) ? data[0]?.id : (data as any)?.id) ?? null;
    },
  });

  useEffect(() => {
    if (classroomId || classrooms.length === 0) return;
    const mine = classrooms.find((c: any) => myPersonnelId && (c.homeroom_teacher_id === myPersonnelId || c.homeroom_teacher_2_id === myPersonnelId));
    setClassroomId((mine || classrooms[0]).id);
  }, [classrooms, myPersonnelId, classroomId]);

  const room = classrooms.find((c: any) => c.id === classroomId);

  const { data: rows, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["score-status", classroomId, year, semester],
    enabled: !!classroomId && !!year,
    queryFn: async () => {
      const sem = Number(semester);
      const yrs = yearsMatch(year!);
      const [assignRes, studentRes, fileRes] = await Promise.all([
        supabase.from("teacher_assignments")
          .select("subject_id, personnel_id, semester, academic_year, subjects(id, code, name_th, credits, subject_type), personnel(prefix, first_name, last_name, user_id)")
          .eq("classroom_id", classroomId),
        supabase.from("students").select("student_code").eq("classroom_id", classroomId).eq("status", "active"),
        supabase.from("pp5_files")
          .select("id, subject_id, subject_code, subject_name, file_name, file_path, file_url, applied_at, announced_at, created_at, teacher_name, semester, academic_year")
          .eq("classroom_id", classroomId)
          .in("academic_year", yrs)
          .order("created_at", { ascending: false }),
      ]);
      if (assignRes.error) throw assignRes.error;
      const assigns = (assignRes.data || []).filter((a: any) =>
        (a.semester == null || a.semester === sem) && (a.academic_year == null || yrs.includes(a.academic_year)));
      const codes = (studentRes.data || []).map((s: any) => s.student_code).filter(Boolean);
      const files = (fileRes.data || []).filter((f: any) => f.semester == null || f.semester === sem);

      const subjectIds = Array.from(new Set(assigns.map((a: any) => a.subject_id)));
      const scored = new Map<string, Set<string>>();
      if (subjectIds.length && codes.length) {
        // แบ่งชุดรหัสเพื่อไม่ให้ URL ยาวเกิน
        for (let i = 0; i < codes.length; i += 200) {
          const { data } = await supabase.from("student_scores")
            .select("subject_id, student_code, total_score, grade, semester, academic_year")
            .in("subject_id", subjectIds)
            .in("student_code", codes.slice(i, i + 200));
          (data || []).forEach((r: any) => {
            if (r.semester != null && r.semester !== sem) return;
            if (r.academic_year != null && !yrs.includes(r.academic_year)) return;
            if (r.total_score == null && !r.grade) return;
            if (!scored.has(r.subject_id)) scored.set(r.subject_id, new Set());
            scored.get(r.subject_id)!.add(r.student_code);
          });
        }
      }

      const bySubject = new Map<string, any>();
      assigns.forEach((a: any) => {
        const cur = bySubject.get(a.subject_id);
        const tName = a.personnel ? `${a.personnel.prefix || ""}${a.personnel.first_name} ${a.personnel.last_name}` : "";
        const uid = a.personnel?.user_id as string | undefined;
        if (cur) { if (tName && !cur.teachers.includes(tName)) cur.teachers.push(tName); if (uid && !cur.userIds.includes(uid)) cur.userIds.push(uid); return; }
        bySubject.set(a.subject_id, { subject: a.subjects, teachers: tName ? [tName] : [], userIds: uid ? [uid] : [] });
      });

      const total = codes.length;
      return Array.from(bySubject.entries()).map(([sid, v]) => {
        const subjectFiles = files.filter((f: any) => f.subject_id === sid || (!f.subject_id && f.subject_code && f.subject_code === v.subject?.code));
        const count = scored.get(sid)?.size || 0;
        let status: Status = "none";
        if ((total > 0 && count >= total) || subjectFiles.some((f: any) => f.applied_at)) status = "complete";
        else if (count > 0 || subjectFiles.length > 0) status = "partial";
        return { sid, ...v, files: subjectFiles, count, total, status, announced: subjectFiles.some((f: any) => f.announced_at) };
      }).sort((a, b) => (a.subject?.code || "").localeCompare(b.subject?.code || "", "th"));
    },
  });

  const remindTeachers = async () => {
    const pending = (rows || []).filter((r: any) => r.status !== "complete");
    const ids = [...new Set(pending.flatMap((r: any) => r.userIds || []))];
    if (!ids.length) { swal.info("ไม่มีครูที่ต้องเตือน", "ทุกวิชาในชั้นนี้ส่งคะแนนครบแล้ว หรือครูยังไม่ได้ผูกบัญชีผู้ใช้"); return; }
    const room = (classrooms as any[]).find((c) => c.id === classroomId)?.name || "";
    if (!(await swal.confirm({ title: `ส่งการแจ้งเตือนถึงครู ${ids.length} คน?`, text: `วิชาที่ยังไม่ส่งคะแนน ${pending.length} วิชา ชั้น ${room} ภาคเรียน ${semester}`, confirmText: "ส่งแจ้งเตือน" }))) return;
    const { error } = await supabase.functions.invoke("notify-fanout", { body: {
      user_ids: ids, type: "grade", severity: "warning",
      title: "เตือนส่งคะแนน ปพ.5",
      body: `ชั้น ${room} ภาคเรียน ${semester}/${year} ยังมีวิชาที่ยังไม่ส่งคะแนน กรุณาอัปโหลดไฟล์ ปพ.5`,
      link: "/dashboard/academic/pp5",
    } });
    if (error) swal.error("ส่งแจ้งเตือนไม่สำเร็จ", error.message);
    else swal.success("ส่งแจ้งเตือนแล้ว", `ส่งถึงครู ${ids.length} คน`);
  };

  const summary = useMemo(() => {
    const s = { complete: 0, partial: 0, none: 0 } as Record<Status, number>;
    (rows || []).forEach((r) => s[r.status as Status]++);
    return s;
  }, [rows]);
  const pct = rows?.length ? Math.round((summary.complete / rows.length) * 100) : 0;

  const openFile = async (f: any, mode: "view" | "download" | "print") => {
    const path = f.file_path || (f.file_url?.match(/\/pp5-files\/(.+?)(\?|$)/)?.[1] ?? "");
    let href = f.file_url;
    if (path) {
      const { data, error } = await supabase.storage.from("pp5-files").createSignedUrl(path, 600, mode === "download" ? { download: f.file_name } : undefined);
      if (error || !data?.signedUrl) { swal.error("เปิดไฟล์ไม่ได้ ไม่พบไฟล์หรือไม่มีสิทธิ์เข้าถึง"); return; }
      href = data.signedUrl;
    }
    if (mode === "download") {
      const a = document.createElement("a");
      a.href = href; a.download = f.file_name; a.rel = "noreferrer"; a.click();
      return;
    }
    // เปิดผ่านตัวแสดงเอกสารของ Microsoft เพื่อดู/สั่งพิมพ์ Excel ได้ทันทีในเบราว์เซอร์
    const viewer = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(href)}`;
    window.open(viewer, "_blank", "noopener,noreferrer");
    if (mode === "print") swal.info("เมื่อไฟล์เปิดแล้ว กดปุ่ม Print ที่แถบด้านบน");
  };

  return (
    <div className="space-y-4 p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ClipboardCheck className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-bold">สถานะการส่งคะแนน</h1>
            <p className="text-sm text-muted-foreground">ติดตามว่าแต่ละวิชาในชั้นเรียนมีผลคะแนนครบหรือยัง</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(isAdmin || isDirector) && (
            <Button variant="outline" size="sm" onClick={remindTeachers} disabled={!rows?.length}>
              <BellRing className="mr-1.5 h-4 w-4" /> เตือนครูที่ยังไม่ส่ง
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> รีเฟรช
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">ชั้นเรียน</p>
            <Select value={classroomId} onValueChange={setClassroomId} disabled={loadingRooms}>
              <SelectTrigger><SelectValue placeholder="เลือกชั้นเรียน" /></SelectTrigger>
              <SelectContent className="max-h-80">
                {classrooms.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">ภาคเรียน</p>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
                <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">ปีการศึกษา</p>
            <Select value={year ? String(year) : ""} onValueChange={(v) => { setYear(Number(v)); setClassroomId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {year && [year + 1, year, year - 1, year - 2].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground">ความคืบหน้า</p><p className="text-2xl font-bold">{pct}%</p><Progress value={pct} className="mt-2 h-2" /></CardContent></Card>
        {(["complete", "partial", "none"] as Status[]).map((s) => (
          <Card key={s}><CardContent className="pt-5">
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><StatusDot s={s} />{STATUS_META[s].label}</p>
            <p className="text-2xl font-bold">{summary[s]} <span className="text-sm font-normal text-muted-foreground">วิชา</span></p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            รายวิชาที่ชั้น {room?.name || "-"} เรียนในภาคเรียนที่ {semester}/{year ?? "-"}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : !rows?.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">ยังไม่มีการมอบหมายวิชาให้ชั้นนี้ในภาคเรียนที่เลือก</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">สถานะ</TableHead>
                  <TableHead>รหัสวิชา</TableHead>
                  <TableHead>รายวิชา</TableHead>
                  <TableHead>ครูผู้สอน</TableHead>
                  <TableHead className="text-center">นักเรียนที่มีคะแนน</TableHead>
                  <TableHead>ผลคะแนน</TableHead>
                  <TableHead className="text-right">ไฟล์ ปพ.5</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.sid}>
                    <TableCell className="text-center"><StatusDot s={r.status} /></TableCell>
                    <TableCell className="font-mono text-sm">{r.subject?.code}</TableCell>
                    <TableCell className="font-medium">{r.subject?.name_th}</TableCell>
                    <TableCell className="text-sm">{r.teachers.join(", ") || <span className="text-muted-foreground">ยังไม่ระบุ</span>}</TableCell>
                    <TableCell className="text-center text-sm">{r.count}/{r.total}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className={STATUS_META[r.status as Status].badge}>{STATUS_META[r.status as Status].label}</Badge>
                        {r.announced && <Badge variant="secondary">ประกาศแล้ว</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.files.length === 0 ? (
                        <span className="text-xs text-muted-foreground">ไม่มีไฟล์</span>
                      ) : (
                        <div className="space-y-1">
                          {r.files.slice(0, 2).map((f: any) => (
                            <div key={f.id} className="flex items-center justify-end gap-1">
                              <FileSpreadsheet className="h-4 w-4 shrink-0 text-success" />
                              <span className="max-w-[140px] truncate text-xs" title={f.file_name}>{f.file_name}</span>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="ดูไฟล์" onClick={() => openFile(f, "view")}><Eye className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="ดาวน์โหลด" onClick={() => openFile(f, "download")}><Download className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="พิมพ์" onClick={() => openFile(f, "print")}><Printer className="h-4 w-4" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
