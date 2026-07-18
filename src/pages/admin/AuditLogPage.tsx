import { useState } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Download, RefreshCw } from "lucide-react";

const ACTION_COLOR: Record<string, string> = {
  login: "bg-emerald-100 text-emerald-800",
  logout: "bg-slate-100 text-slate-800",
  create: "bg-blue-100 text-blue-800",
  update: "bg-amber-100 text-amber-800",
  delete: "bg-red-100 text-red-800",
  export: "bg-purple-100 text-purple-800",
  import: "bg-indigo-100 text-indigo-800",
};

const fmt = (d: string) => new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "medium" });

export default function AuditLogPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [limit, setLimit] = useState(200);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["audit_logs", limit],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      return data ?? [];
    },
  });

  const filtered = logs.filter((l: any) => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        (l.user_name || "").toLowerCase().includes(s) ||
        (l.action || "").toLowerCase().includes(s) ||
        (l.target_table || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const exportCsv = () => {
    const rows = [
      ["เวลา", "ผู้ใช้", "Role", "Action", "Target", "Details"],
      ...filtered.map((l: any) => [
        fmt(l.created_at),
        l.user_name || "-",
        l.user_role || "-",
        l.action,
        `${l.target_table || ""} ${l.target_id || ""}`.trim(),
        JSON.stringify(l.details || {}),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit_log_${todayBangkok()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueActions = Array.from(new Set(logs.map((l: any) => l.action))).sort();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            ประวัติการใช้งาน (Audit Log)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Input
              placeholder="ค้นหา (ผู้ใช้, action, ตาราง)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {uniqueActions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100 รายการ</SelectItem>
                <SelectItem value="200">200 รายการ</SelectItem>
                <SelectItem value="500">500 รายการ</SelectItem>
                <SelectItem value="1000">1,000 รายการ</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" /> รีเฟรช
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">เวลา</TableHead>
                  <TableHead>ผู้ใช้</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">กำลังโหลด...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
                ) : (
                  filtered.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">{fmt(l.created_at)}</TableCell>
                      <TableCell className="text-sm">{l.user_name || "-"}</TableCell>
                      <TableCell><Badge variant="outline">{l.user_role || "-"}</Badge></TableCell>
                      <TableCell>
                        <Badge className={ACTION_COLOR[l.action] || "bg-slate-100 text-slate-800"}>{l.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.target_table ? `${l.target_table}${l.target_id ? `/${String(l.target_id).slice(0, 8)}` : ""}` : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                        {l.details && Object.keys(l.details).length > 0 ? JSON.stringify(l.details) : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            แสดง {filtered.length.toLocaleString()} รายการ • อัปเดตล่าสุด {logs[0] ? fmt((logs[0] as any).created_at) : "-"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}