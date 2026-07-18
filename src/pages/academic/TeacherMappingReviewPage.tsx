import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { UserCheck, Search, AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";
import { confirmUpdate } from "@/lib/confirmAction";

interface Personnel {
  id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  department: string | null;
}

interface Report {
  id: string;
  teacher_name_text: string | null;
  teacher_id: string | null;
}

interface GroupRow {
  key: string;                 // teacher_name_text (or "" if null)
  displayName: string;
  count: number;
  teacherId: string | null;    // majority teacher_id
  teacherName: string | null;
  conflict: boolean;           // multiple different teacher_ids for same text
  reportIds: string[];
}

export default function TeacherMappingReviewPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "unmapped" | "conflict">("all");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [personnelQuery, setPersonnelQuery] = useState("");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["teacher-mapping-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incomplete_grade_reports")
        .select("id, teacher_name_text, teacher_id");
      if (error) throw error;
      return (data || []) as Report[];
    },
    staleTime: 30_000,
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ["personnel-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, first_name, last_name, position")
        .order("first_name");
      if (error) throw error;
      return (data || []) as Personnel[];
    },
    staleTime: 5 * 60_000,
  });

  const personnelById = useMemo(() => {
    const m = new Map<string, Personnel>();
    personnel.forEach((p) => m.set(p.id, p));
    return m;
  }, [personnel]);

  const groups = useMemo<GroupRow[]>(() => {
    const map = new Map<string, { name: string; ids: string[]; teacherIds: Map<string | null, number> }>();
    for (const r of reports) {
      const key = r.teacher_name_text?.trim() || "";
      const g = map.get(key) || { name: r.teacher_name_text ?? "(ไม่ระบุชื่อครู)", ids: [], teacherIds: new Map() };
      g.ids.push(r.id);
      g.teacherIds.set(r.teacher_id, (g.teacherIds.get(r.teacher_id) ?? 0) + 1);
      map.set(key, g);
    }
    const rows: GroupRow[] = [];
    for (const [key, g] of map.entries()) {
      // choose majority
      let bestId: string | null = null;
      let bestCount = -1;
      for (const [tid, c] of g.teacherIds) {
        if (c > bestCount) { bestCount = c; bestId = tid; }
      }
      const nonNullDistinct = Array.from(g.teacherIds.keys()).filter(Boolean);
      const conflict = nonNullDistinct.length > 1;
      const p = bestId ? personnelById.get(bestId) : null;
      rows.push({
        key,
        displayName: g.name,
        count: g.ids.length,
        teacherId: bestId,
        teacherName: p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : null,
        conflict,
        reportIds: g.ids,
      });
    }
    return rows.sort((a, b) => b.count - a.count);
  }, [reports, personnelById]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return groups.filter((r) => {
      if (filter === "unmapped" && r.teacherId) return false;
      if (filter === "conflict" && !r.conflict) return false;
      if (!s) return true;
      return (
        r.displayName.toLowerCase().includes(s) ||
        (r.teacherName ?? "").toLowerCase().includes(s)
      );
    });
  }, [groups, filter, q]);

  const stats = useMemo(() => ({
    total: groups.length,
    mapped: groups.filter((g) => g.teacherId).length,
    unmapped: groups.filter((g) => !g.teacherId).length,
    conflict: groups.filter((g) => g.conflict).length,
    reports: reports.length,
  }), [groups, reports]);

  const filteredPersonnel = useMemo(() => {
    const s = personnelQuery.trim().toLowerCase();
    if (!s) return personnel.slice(0, 50);
    return personnel
      .filter((p) =>
        `${p.first_name ?? ""} ${p.last_name ?? ""}`.toLowerCase().includes(s) ||
        (p.position ?? "").toLowerCase().includes(s)
      )
      .slice(0, 50);
  }, [personnel, personnelQuery]);

  const editingGroup = groups.find((g) => g.key === editingKey) || null;

  const openEdit = (g: GroupRow) => {
    setEditingKey(g.key);
    setSelectedPersonnelId(g.teacherId);
    setPersonnelQuery("");
  };

  const applyMapping = async () => {
    if (!editingGroup || !selectedPersonnelId) return;
    const p = personnelById.get(selectedPersonnelId);
    const ok = await confirmUpdate(
      `ยืนยันแมพ "${editingGroup.displayName}" → ${p?.first_name ?? ""} ${p?.last_name ?? ""} (${editingGroup.count} รายการ)?`
    );
    if (!ok) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("incomplete_grade_reports")
        .update({ teacher_id: selectedPersonnelId })
        .in("id", editingGroup.reportIds);
      if (error) throw error;
      toast.success(`อัปเดตแล้ว ${editingGroup.count} รายการ`);
      setEditingKey(null);
      qc.invalidateQueries({ queryKey: ["teacher-mapping-reports"] });
    } catch (e: any) {
      toast.error(e.message || "อัปเดตไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={UserCheck}
        title="ตรวจสอบการแมพชื่อครูกับบัญชีในระบบ"
        description="รายงาน 0/ร/มส · ตรวจสอบและแก้ไขการเชื่อมชื่อครูกับข้อมูลบุคลากรจริง เพื่อให้คำร้องแก้เกรดถึงมือครูที่ถูกต้อง"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="ชื่อครูทั้งหมด" value={stats.total} />
        <StatCard label="แมพแล้ว" value={stats.mapped} tone="success" />
        <StatCard label="ยังไม่แมพ" value={stats.unmapped} tone="danger" />
        <StatCard label="แมพไม่ตรงกัน" value={stats.conflict} tone="warning" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหาชื่อครูตามที่ปรากฏในรายงาน หรือชื่อบุคลากรในระบบ..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {([
                { k: "all", label: `ทั้งหมด (${stats.total})` },
                { k: "unmapped", label: `ยังไม่แมพ (${stats.unmapped})` },
                { k: "conflict", label: `ไม่ตรงกัน (${stats.conflict})` },
              ] as const).map(({ k, label }) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    filter === k
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อครูในรายงาน</TableHead>
                  <TableHead>จำนวนรายการ</TableHead>
                  <TableHead>แมพกับบุคลากร</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      กำลังโหลด...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      ไม่พบข้อมูล
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((g) => (
                    <TableRow key={g.key || "__none__"}>
                      <TableCell className="font-medium">{g.displayName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{g.count}</Badge>
                      </TableCell>
                      <TableCell>
                        {g.teacherName ? (
                          <span className="text-sm">{g.teacherName}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">— ยังไม่แมพ —</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!g.teacherId ? (
                          <Badge className="bg-danger/15 text-danger border-danger/40 gap-1">
                            <AlertTriangle className="w-3 h-3" /> ไม่แมพ
                          </Badge>
                        ) : g.conflict ? (
                          <Badge className="bg-warning/15 text-warning border-warning/40 gap-1">
                            <AlertTriangle className="w-3 h-3" /> ไม่ตรงกัน
                          </Badge>
                        ) : (
                          <Badge className="bg-success/15 text-success border-success/40 gap-1">
                            <CheckCircle2 className="w-3 h-3" /> ถูกต้อง
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEdit(g)}>
                          แก้ไข
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingGroup} onOpenChange={(o) => !o && setEditingKey(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>แก้ไขการแมพครู</DialogTitle>
            <DialogDescription>
              เลือกบุคลากรที่ตรงกับ <span className="font-semibold text-foreground">{editingGroup?.displayName}</span> — จะอัปเดต {editingGroup?.count ?? 0} รายการ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={personnelQuery}
                onChange={(e) => setPersonnelQuery(e.target.value)}
                placeholder="ค้นหาชื่อบุคลากร..."
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border divide-y">
              {filteredPersonnel.length === 0 ? (
                <div className="p-6 text-sm text-center text-muted-foreground">ไม่พบบุคลากร</div>
              ) : (
                filteredPersonnel.map((p) => {
                  const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
                  const active = selectedPersonnelId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPersonnelId(p.id)}
                      className={`w-full text-left p-3 hover:bg-muted transition-colors ${
                        active ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{name || "(ไม่มีชื่อ)"}</p>
                          {p.position && (
                            <p className="text-xs text-muted-foreground">{p.position}</p>
                          )}
                        </div>
                        {active && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingKey(null)} disabled={saving}>
              ยกเลิก
            </Button>
            <Button onClick={applyMapping} disabled={!selectedPersonnelId || saving} className="gap-1">
              <Save className="w-4 h-4" /> บันทึกการแมพ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" | "warning" }) {
  const toneCls =
    tone === "success" ? "text-success" :
    tone === "danger" ? "text-danger" :
    tone === "warning" ? "text-warning" :
    "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${toneCls}`}>{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}
