import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, AlertTriangle, History } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

function LoanPhoto({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const match = url.match(/\/ict-loan-photos\/(.+?)(\?|$)/) || url.match(/\/asset-photos\/(.+?)(\?|$)/);
      if (match) {
        const bucket = url.includes("/ict-loan-photos/") ? "ict-loan-photos" : "asset-photos";
        const { data } = await supabase.storage.from(bucket).createSignedUrl(match[1], 3600);
        if (!cancelled) setSrc(data?.signedUrl || url);
      } else {
        if (!cancelled) setSrc(url);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);
  if (!src) return <div className="w-10 h-10 rounded border bg-muted" />;
  return <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={alt} className="w-10 h-10 object-cover rounded border" /></a>;
}

type Loan = {
  id: string; status: string;
  borrowed_at: string; expected_return_at: string | null; returned_at: string | null;
  borrow_photo_url: string | null; return_photo_url: string | null;
  borrow_notes: string | null; return_notes: string | null;
  ict_devices: { name: string; asset_code: string; serial_number: string | null } | null;
  students: { student_code: string; prefix: string; first_name: string; last_name: string; classrooms?: { name: string } | null } | null;
  personnel: { employee_code: string | null; prefix: string | null; first_name: string; last_name: string; department: string | null } | null;
};

export default function IctLoanHistoryPage() {
  const { userId, isAdmin, isDirector, loading: roleLoading } = useUserRole();
  const canSeeAll = isAdmin || isDirector;
  const [loans, setLoans] = useState<Loan[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "returned">("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    let query = supabase.from("ict_loans")
      .select("id,status,borrowed_at,expected_return_at,returned_at,borrow_photo_url,return_photo_url,borrow_notes,return_notes,student_id,personnel_id,ict_devices(name,asset_code,serial_number),students(student_code,prefix,first_name,last_name,classrooms!students_classroom_id_fkey(name)),personnel(employee_code,prefix,first_name,last_name,department)")
      .order("borrowed_at", { ascending: false }).limit(500);
    if (filter === "active") query = query.eq("status", "active");
    else if (filter === "returned") query = query.eq("status", "returned");
    else if (filter === "overdue") query = query.eq("status", "active").lt("expected_return_at", new Date().toISOString());

    if (!canSeeAll) {
      const [{ data: stu }, { data: per }] = await Promise.all([
        supabase.from("students").select("id").eq("auth_user_id", userId).maybeSingle(),
        supabase.from("personnel").select("id").eq("user_id", userId).maybeSingle(),
      ]);
      const studentId = (stu as any)?.id;
      const personnelId = (per as any)?.id;
      if (!studentId && !personnelId) {
        setLoans([]);
        setLoading(false);
        return;
      }
      const ors: string[] = [];
      if (studentId) ors.push(`student_id.eq.${studentId}`);
      if (personnelId) ors.push(`personnel_id.eq.${personnelId}`);
      query = query.or(ors.join(","));
    }

    const { data } = await query;
    setLoans((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { if (!roleLoading) load(); }, [filter, roleLoading, userId, canSeeAll]);

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "-";
  const isOverdue = (l: Loan) => l.status === "active" && l.expected_return_at && new Date(l.expected_return_at) < new Date();

  const filtered = loans.filter((l) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      l.students?.student_code?.toLowerCase().includes(s) ||
      `${l.students?.first_name} ${l.students?.last_name}`.toLowerCase().includes(s) ||
      (l.personnel?.employee_code || "").toLowerCase().includes(s) ||
      `${l.personnel?.first_name || ""} ${l.personnel?.last_name || ""}`.toLowerCase().includes(s) ||
      l.ict_devices?.asset_code?.toLowerCase().includes(s) ||
      l.ict_devices?.serial_number?.toLowerCase().includes(s) ||
      l.ict_devices?.name?.toLowerCase().includes(s)
    );
  });

  const overdueCount = loans.filter(isOverdue).length;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><History className="w-6 h-6" /> ประวัติการยืม-คืน ICT</h1>
        <p className="text-sm text-muted-foreground">ดูประวัติทั้งหมด ค้นหาตามนักเรียน/อุปกรณ์ และตรวจสอบรายการเกินกำหนด</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>ทั้งหมด</Button>
        <Button variant={filter === "active" ? "default" : "outline"} size="sm" onClick={() => setFilter("active")}>ค้างคืน</Button>
        <Button variant={filter === "overdue" ? "default" : "outline"} size="sm" onClick={() => setFilter("overdue")}>
          <AlertTriangle className="w-4 h-4 mr-1" /> เกินกำหนด {overdueCount > 0 && <Badge variant="destructive" className="ml-1">{overdueCount}</Badge>}
        </Button>
        <Button variant={filter === "returned" ? "default" : "outline"} size="sm" onClick={() => setFilter("returned")}>คืนแล้ว</Button>
        <div className="ml-auto flex gap-2 items-center">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="ค้นหา (รหัส/ชื่อ/SN)" value={q} onChange={(e) => setQ(e.target.value)} className="w-60" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">รายการ ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ผู้ยืม</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>อุปกรณ์ / SN</TableHead>
                <TableHead>ยืม</TableHead>
                <TableHead>กำหนดคืน</TableHead>
                <TableHead>คืน</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>ภาพ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่พบรายการ</TableCell></TableRow>
              ) : filtered.map((l) => (
                <TableRow key={l.id} className={isOverdue(l) ? "bg-destructive/5" : ""}>
                  <TableCell>
                    <div className="font-medium">
                      {l.students ? `${l.students.prefix}${l.students.first_name} ${l.students.last_name}` :
                       l.personnel ? `${l.personnel.prefix || ""}${l.personnel.first_name} ${l.personnel.last_name}` : "-"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.students ? `${l.students.student_code} · ${l.students.classrooms?.name || "-"}` :
                       l.personnel ? `${l.personnel.employee_code || "-"} · ${l.personnel.department || "-"}` : "-"}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{l.students ? "นักเรียน" : "บุคลากร"}</Badge></TableCell>
                  <TableCell>
                    <div>{l.ict_devices?.name || "-"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{l.ict_devices?.serial_number || l.ict_devices?.asset_code || "-"}</div>
                  </TableCell>
                  <TableCell className="text-xs">{fmt(l.borrowed_at)}</TableCell>
                  <TableCell className="text-xs">
                    {l.expected_return_at ? (
                      <span className={isOverdue(l) ? "text-destructive font-medium" : ""}>{fmt(l.expected_return_at)}</span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-xs">{fmt(l.returned_at)}</TableCell>
                  <TableCell>
                    {isOverdue(l) ? <Badge variant="destructive">เกินกำหนด</Badge> :
                      l.status === "returned" ? <Badge variant="secondary">คืนแล้ว</Badge> :
                      <Badge variant="outline">{l.status}</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {l.borrow_photo_url && <LoanPhoto url={l.borrow_photo_url} alt="borrow" />}
                      {l.return_photo_url && <LoanPhoto url={l.return_photo_url} alt="return" />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}