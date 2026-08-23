import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw, Send, ShieldAlert, Activity, Loader2, Search, Bell } from "lucide-react";
import { calculateRisk, getAtRiskStudents, riskBadgeClass, riskLabel, type RiskResult, type RiskLevel } from "@/lib/earlyWarning";

type AtRiskRow = RiskResult & {
  // enriched from DB join for display stability
};

const RISK_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "high", label: "เสี่ยงสูง" },
  { value: "medium", label: "ปานกลาง" },
  { value: "low", label: "ปกติ" },
];

export default function EarlyWarningPage() {
  const qc = useQueryClient();
  const [filterRisk, setFilterRisk] = useState<string>("high");
  const [search, setSearch] = useState("");
  const [notifyingId, setNotifyingId] = useState<string | null>(null);

  // Main query — live calculation via getAtRiskStudents() when filter is high/medium,
  // otherwise fetch via calculateRisk batch. Also loads early_warnings history for notified flag.
  const { data: atRisk = [], isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["early-warning-at-risk", filterRisk],
    queryFn: async () => {
      // For "all" we want all levels; for specific we filter after
      const onlyHigh = filterRisk === "high";
      // Use lib that scans all students — returns live risk
      // For broader filters, get all then filter client-side
      const list = await getAtRiskStudents({ onlyHigh: false, limit: 800, concurrency: 8 });
      if (filterRisk === "all") return list;
      return list.filter((r) => r.riskLevel === filterRisk);
    },
    staleTime: 2 * 60 * 1000,
  });

  // History from early_warnings table (last 30 days) for audit trail
  const { data: history = [] } = useQuery({
    queryKey: ["early-warnings-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("early_warnings" as any)
        .select("id, student_id, risk_level, reasons, score, details, calculated_at, notified, notified_at")
        .order("calculated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const historyMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const h of history) {
      if (!m.has(h.student_id)) m.set(h.student_id, h);
    }
    return m;
  }, [history]);

  const filtered = useMemo(() => {
    if (!search.trim()) return atRisk;
    const q = search.trim().toLowerCase();
    return atRisk.filter(
      (r) =>
        (r.studentCode || "").toLowerCase().includes(q) ||
        (r.studentName || "").toLowerCase().includes(q) ||
        (r.classroomName || "").toLowerCase().includes(q) ||
        r.reasons.join(" ").toLowerCase().includes(q)
    );
  }, [atRisk, search]);

  const counts = useMemo(() => {
    const c: Record<RiskLevel, number> = { high: 0, medium: 0, low: 0 };
    atRisk.forEach((r) => {
      c[r.riskLevel] = (c[r.riskLevel] || 0) + 1;
    });
    // counts for all levels queried overall (for cards we show live totals)
    return c;
  }, [atRisk]);

  // Also compute totals across all levels for cards (fetch once extra for cards)
  const { data: allCountsRaw } = useQuery({
    queryKey: ["early-warning-counts"],
    queryFn: async () => {
      const list = await getAtRiskStudents({ onlyHigh: false, limit: 800, concurrency: 8 });
      const cc: Record<string, number> = { high: 0, medium: 0, low: 0, total: list.length };
      list.forEach((r) => (cc[r.riskLevel] = (cc[r.riskLevel] || 0) + 1));
      return cc;
    },
    staleTime: 2 * 60 * 1000,
  });

  const handleNotify = async (row: RiskResult) => {
    setNotifyingId(row.studentId);
    try {
      // Resolve recipients: homeroom teacher(s) + parents + admins (via notify-fanout user_ids)
      // 1) fetch student -> classroom -> homeroom personnel -> user_id
      // 2) fetch parents via profiles.student_code + students.parent_user_id
      // For simplicity we parallelize
      const { data: stu } = await supabase
        .from("students")
        .select("id, student_code, classroom_id, auth_user_id, parent_user_id, parent_user_id_2")
        .eq("id", row.studentId)
        .maybeSingle();

      const userIds = new Set<string>();

      // parents
      if ((stu as any)?.parent_user_id) userIds.add((stu as any).parent_user_id);
      if ((stu as any)?.parent_user_id_2) userIds.add((stu as any).parent_user_id_2);
      if ((stu as any)?.student_code) {
        const { data: parents } = await supabase
          .from("profiles")
          .select("id")
          .eq("student_code", (stu as any).student_code);
        (parents || []).forEach((p: any) => p.id && userIds.add(p.id));
      }
      // student self
      if ((stu as any)?.auth_user_id) userIds.add((stu as any).auth_user_id);

      // homeroom teachers
      if ((stu as any)?.classroom_id) {
        const { data: cls } = await supabase
          .from("classrooms")
          .select("homeroom_teacher_id, homeroom_teacher_2_id")
          .eq("id", (stu as any).classroom_id)
          .maybeSingle();
        const pIds = [ (cls as any)?.homeroom_teacher_id, (cls as any)?.homeroom_teacher_2_id ].filter(Boolean);
        if (pIds.length) {
          const { data: personnel } = await supabase
            .from("personnel")
            .select("user_id")
            .in("id", pIds);
          (personnel || []).forEach((p: any) => p.user_id && userIds.add(p.user_id));
        }
      }

      // also include admins/directors for audit (but main is teacher/parent)
      const { data: admins } = await supabase.from("user_roles").select("user_id").in("role", ["admin", "director"]);
      const adminIds: string[] = (admins || []).map((r: any) => r.user_id).filter(Boolean);
      // we will send fanout to teachers+parents+admins together but mark as early_warning so routing respects prefs
      const allIds = Array.from(userIds);
      if (allIds.length === 0) {
        // fallback to admins if no parent/teacher linked
        if (adminIds.length === 0) {
          toast.error("ไม่พบผู้รับแจ้งเตือนที่ผูกกับนักเรียนคนนี้");
          return;
        }
        // notify admins at least
        allIds.push(...adminIds);
      }

      const title = `⚠️ แจ้งเตือนความเสี่ยงหลุดจากระบบ — ${row.studentName || row.studentCode}`;
      const body = `นักเรียน ${row.studentName || row.studentCode} (${row.classroomName || "-"}) อยู่ในเกณฑ์ "${riskLabel(row.riskLevel)}" — ${row.reasons.join(" • ")}`;
      const fields: Record<string, string> = {
        นักเรียน: `${row.studentName || "-"} (${row.studentCode || row.studentId.slice(0, 8)})`,
        ห้อง: row.classroomName || "-",
        ระดับความเสี่ยง: riskLabel(row.riskLevel),
        เหตุผล: row.reasons.join(", "),
        ...(row.details.attendanceRate != null ? { "การมาเรียน": `${row.details.attendanceRate.toFixed(1)}%` } : {}),
        ...(row.details.gpa != null ? { GPA: row.details.gpa.toFixed(2) } : {}),
      };

      const { error } = await supabase.functions.invoke("notify-fanout", {
        body: {
          user_ids: Array.from(new Set(allIds)),
          title,
          body,
          type: "early_warning",
          severity: row.riskLevel === "high" ? "warning" : "info",
          reference_id: row.studentId,
          reference_type: "early_warning",
          url: "/dashboard/admin/early-warning",
          fields,
          dedup_key: `early-warning-${row.studentId}-${new Date().toISOString().slice(0,10)}`,
        },
      });
      if (error) throw error;

      // mark early_warnings row as notified (if exists)
      const hist = historyMap.get(row.studentId);
      if (hist?.id) {
        await supabase.from("early_warnings" as any).update({ notified: true, notified_at: new Date().toISOString() } as any).eq("id", hist.id);
      } else {
        // insert audit row
        await supabase.from("early_warnings" as any).insert({
          student_id: row.studentId,
          risk_level: row.riskLevel,
          reasons: row.reasons,
          score: row.score,
          details: row.details,
          calculated_at: row.calculatedAt,
          notified: true,
          notified_at: new Date().toISOString(),
        } as any);
      }

      toast.success(`แจ้งเตือนครู/ผู้ปกครองของ ${row.studentName || row.studentCode} แล้ว`);
      qc.invalidateQueries({ queryKey: ["early-warnings-history"] });
    } catch (e: any) {
      toast.error(e?.message || "แจ้งเตือนล้มเหลว");
    } finally {
      setNotifyingId(null);
    }
  };

  const handleRecalcOne = async (studentId: string) => {
    try {
      toast.info("กำลังคำนวณใหม่...");
      const r = await calculateRisk(studentId);
      toast.success(`${r.studentName || r.studentCode}: ${riskLabel(r.riskLevel)} — ${r.reasons.join(" • ") || "ไม่มีเหตุผลเสี่ยง"}`);
      // save to history
      await supabase.from("early_warnings" as any).insert({
        student_id: r.studentId,
        risk_level: r.riskLevel,
        reasons: r.reasons,
        score: r.score,
        details: r.details,
        calculated_at: r.calculatedAt,
        notified: false,
      } as any);
      qc.invalidateQueries({ queryKey: ["early-warning-at-risk"] });
      qc.invalidateQueries({ queryKey: ["early-warnings-history"] });
    } catch (e: any) {
      toast.error(e?.message || "คำนวณล้มเหลว");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Early Warning — แจ้งเตือนเสี่ยงหลุดจากระบบ</h1>
            <p className="text-sm text-muted-foreground">
              คัดกรองจาก: มาเรียน &lt;80% • ติด 0 ร มส มผ • GPA &lt;2.0 • พฤติกรรมเชิงลบ • SDQ สูง
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            รีเฟรช
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={async () => {
              try {
                const { error } = await supabase.functions.invoke("early-warning-cron", { body: { trigger: "manual", dryRun: false } });
                if (error) throw error;
                toast.success("รัน Early Warning cron สำเร็จ — กำลังโหลดใหม่");
                qc.invalidateQueries({ queryKey: ["early-warning-at-risk"] });
                qc.invalidateQueries({ queryKey: ["early-warnings-history"] });
              } catch (e: any) {
                toast.error(e?.message || "เรียก cron ล้มเหลว (ตรวจสอบสิทธิ์ admin)");
              }
            }}
          >
            <Activity className="w-4 h-4 mr-1" />
            รันตรวจสอบทั้งโรงเรียน
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-red-200">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">เสี่ยงสูง</p>
            <p className="text-2xl font-bold text-red-600">{allCountsRaw?.high ?? counts.high ?? 0}</p>
            <Badge className="mt-1 bg-red-100 text-red-700 border-red-200">high</Badge>
          </CardContent>
        </Card>
        <Card className="border-amber-200">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">ปานกลาง</p>
            <p className="text-2xl font-bold text-amber-600">{allCountsRaw?.medium ?? counts.medium ?? 0}</p>
            <Badge className="mt-1 bg-amber-100 text-amber-700 border-amber-200">medium</Badge>
          </CardContent>
        </Card>
        <Card className="border-emerald-200">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">ปกติ</p>
            <p className="text-2xl font-bold text-emerald-600">{allCountsRaw?.low ?? counts.low ?? 0}</p>
            <Badge className="mt-1 bg-emerald-100 text-emerald-700 border-emerald-200">low</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-muted-foreground">ทั้งหมดที่สแกน</p>
            <p className="text-2xl font-bold">{allCountsRaw?.total ?? atRisk.length}</p>
            <p className="text-xs text-muted-foreground mt-1">active students</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="ค้นหา รหัส/ชื่อ/ห้อง/เหตุผล..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="hidden sm:flex items-center gap-1 h-9 px-3">
            <Bell className="w-3 h-3" />
            {filtered.length} ราย
          </Badge>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            รายชื่อนักเรียนกลุ่มเสี่ยง
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </CardTitle>
          <CardDescription>
            ระดับ high = ต้องติดตามทันที • ปุ่ม "แจ้งครู/ผู้ปกครอง" จะส่งผ่าน notify-fanout (in-app + push + LINE)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[140px]">นักเรียน</TableHead>
                  <TableHead>ห้อง</TableHead>
                  <TableHead>ความเสี่ยง</TableHead>
                  <TableHead className="min-w-[320px]">เหตุผล</TableHead>
                  <TableHead className="hidden md:table-cell">รายละเอียด</TableHead>
                  <TableHead className="text-right min-w-[160px]">แจ้งเตือน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mt-2">กำลังคำนวณความเสี่ยง...</p>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-destructive">
                      โหลดล้มเหลว: {(error as any)?.message}
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {filterRisk === "high" ? "ไม่มีนักเรียนเสี่ยงสูง — เยี่ยม! 🎉" : "ไม่มีข้อมูลในเกณฑ์นี้"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => {
                    const hist = historyMap.get(r.studentId);
                    const alreadyNotified = !!hist?.notified;
                    return (
                      <TableRow key={r.studentId}>
                        <TableCell>
                          <div className="font-medium text-sm">
                            <span className="font-mono text-xs text-muted-foreground mr-1">{r.studentCode || r.studentId.slice(0, 8)}</span>
                            {r.studentName || "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">score {r.score} • {new Date(r.calculatedAt).toLocaleDateString("th-TH")}</div>
                        </TableCell>
                        <TableCell className="text-sm">{r.classroomName || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`border ${riskBadgeClass(r.riskLevel)}`}>
                            {riskLabel(r.riskLevel)}
                          </Badge>
                          {alreadyNotified && (
                            <Badge variant="outline" className="ml-1 text-xs bg-sky-50 text-sky-700 border-sky-200">
                              แจ้งแล้ว
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[360px]">
                            {r.reasons.length > 0 ? (
                              r.reasons.map((rs, i) => (
                                <Badge key={i} variant="outline" className="text-xs font-normal bg-muted/50">
                                  {rs}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[180px]">
                          <div>มาเรียน: {r.details.attendanceRate != null ? `${r.details.attendanceRate.toFixed(1)}%` : "-"}</div>
                          <div>GPAX: {r.details.gpa != null ? r.details.gpa.toFixed(2) : "-"}</div>
                          <div>
                            0/ร/มส: {r.details.remediationCount ?? 0} • พฤติกรรมลบ: {r.details.behaviorNegativeCount ?? 0}
                          </div>
                          <div>SDQ: {r.details.sdqTotal ?? "-"} {r.details.sdqLevel ? `(${r.details.sdqLevel})` : ""}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => handleRecalcOne(r.studentId)} title="คำนวณใหม่">
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant={r.riskLevel === "high" ? "default" : "outline"}
                              onClick={() => handleNotify(r)}
                              disabled={notifyingId === r.studentId}
                              className="gap-1"
                            >
                              {notifyingId === r.studentId ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                              แจ้งครู/ผู้ปกครอง
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 py-2 text-xs text-muted-foreground border-t">
            แสดง {filtered.length} ราย • อัปเดตล่าสุด {new Date().toLocaleString("th-TH")} • เกณฑ์: มาเรียน &lt;80% (นับ present+late), ติด 0/ร/มส/มผ ที่ยังไม่ผ่าน, GPAX &lt;2.0, พฤติกรรมเชิงลบ ≥3 ครั้ง, SDQ ≥14
          </div>
        </CardContent>
      </Card>

      {/* History audit */}
      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">ประวัติการคำนวณล่าสุด (early_warnings)</CardTitle>
            <CardDescription>100 รายการล่าสุด • แสดงสถานะแจ้งเตือนแล้ว</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เวลา</TableHead>
                    <TableHead>student_id</TableHead>
                    <TableHead>ระดับ</TableHead>
                    <TableHead>เหตุผล</TableHead>
                    <TableHead>แจ้งแล้ว</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.slice(0, 20).map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs">{new Date(h.calculated_at).toLocaleString("th-TH")}</TableCell>
                      <TableCell className="font-mono text-xs">{h.student_id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={riskBadgeClass(h.risk_level)}>
                          {riskLabel(h.risk_level)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate">{Array.isArray(h.reasons) ? h.reasons.join(" • ") : JSON.stringify(h.reasons)}</TableCell>
                      <TableCell>{h.notified ? <Badge className="bg-sky-100 text-sky-700">ใช่</Badge> : <Badge variant="outline">ยัง</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
