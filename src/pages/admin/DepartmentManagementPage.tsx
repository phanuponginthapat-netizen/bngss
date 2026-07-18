import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Building2, Search, UserCog, Crown, Trash2, Shield, UserCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { swal } from "@/lib/swal";
import SubjectGroupHeadsCard from "@/components/admin/SubjectGroupHeadsCard";

type DeptPosition = "head" | "deputy" | "assistant" | "member";

const POSITIONS: { value: DeptPosition; th: string; en: string; icon: any; variant: "default" | "secondary" | "outline" }[] = [
  { value: "head", th: "หัวหน้าฝ่าย", en: "Head", icon: Crown, variant: "default" },
  { value: "deputy", th: "รองหัวหน้าฝ่าย", en: "Deputy", icon: Shield, variant: "secondary" },
  { value: "assistant", th: "ผู้ช่วยฝ่าย", en: "Assistant", icon: UserCheck, variant: "secondary" },
  { value: "member", th: "เจ้าหน้าที่", en: "Member", icon: UserCog, variant: "outline" },
];


const DEPARTMENTS = [
  { value: "academic", th: "ฝ่ายวิชาการ", en: "Academic Affairs" },
  { value: "student_affairs", th: "ฝ่ายกิจการนักเรียน", en: "Student Affairs" },
  { value: "general_admin", th: "ฝ่ายบริหารงานทั่วไป", en: "General Administration" },
  { value: "budget_planning", th: "ฝ่ายงบประมาณและแผน", en: "Budget & Planning" },
  { value: "personnel", th: "ฝ่ายบุคคล", en: "Personnel" },
  { value: "director_office", th: "สำนักผู้อำนวยการ", en: "Director's Office" },
  { value: "connexted", th: "ฝ่ายงาน ConnextED", en: "ConnextED" },
] as const;

type DeptValue = typeof DEPARTMENTS[number]["value"];

export default function DepartmentManagementPage() {
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "en" ? en : th);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<any | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<Record<DeptValue, boolean>>({} as any);
  const [posDepts, setPosDepts] = useState<Record<DeptValue, DeptPosition>>({} as any);


  const { data: users = [] } = useQuery({
    queryKey: ["dept-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, employee_code")
        .order("first_name");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
      return (profiles || [])
        .map((p: any) => ({ ...p, role: roleMap.get(p.id) }))
        .filter((p: any) => p.role && p.role !== "student" && p.role !== "alumni" && p.role !== "parent");
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["user_departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_departments").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const byUser = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of assignments) {
      const arr = map.get(a.user_id) || [];
      arr.push(a);
      map.set(a.user_id, arr);
    }
    return map;
  }, [assignments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u: any) =>
      `${u.first_name} ${u.last_name} ${u.employee_code || ""}`.toLowerCase().includes(q)
    );
  }, [users, search]);

  const openEdit = (u: any) => {
    setEditUser(u);
    const current = byUser.get(u.id) || [];
    const sel: any = {}, pos: any = {};
    for (const d of DEPARTMENTS) {
      const found = current.find((c: any) => c.department === d.value);
      sel[d.value] = !!found;
      pos[d.value] = (found?.position as DeptPosition) || "member";
    }
    setSelectedDepts(sel);
    setPosDepts(pos);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      const current = byUser.get(editUser.id) || [];
      const currentMap = new Map(current.map((c: any) => [c.department, c]));
      const ops: PromiseLike<any>[] = [];

      for (const d of DEPARTMENTS) {
        const want = selectedDepts[d.value];
        const wantPos = (posDepts[d.value] || "member") as DeptPosition;
        const existing: any = currentMap.get(d.value);
        if (want && !existing) {
          ops.push(
            supabase.from("user_departments").insert({
              user_id: editUser.id,
              department: d.value as any,
              position: wantPos as any,
            } as any)
          );
        } else if (!want && existing) {
          ops.push(supabase.from("user_departments").delete().eq("id", existing.id));
        } else if (want && existing && existing.position !== wantPos) {
          ops.push(
            supabase
              .from("user_departments")
              .update({ position: wantPos as any } as any)
              .eq("id", existing.id)
          );
        }
      }
      const results = await Promise.all(ops);
      const err = results.find((r: any) => r?.error);
      if (err) throw (err as any).error;
    },
    onSuccess: () => {
      toast.success(L("บันทึกฝ่ายเรียบร้อย", "Departments saved"));
      qc.invalidateQueries({ queryKey: ["user_departments"] });
      setEditUser(null);
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });


  const removeAll = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_departments").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(L("ลบฝ่ายทั้งหมดแล้ว", "All departments removed"));
      qc.invalidateQueries({ queryKey: ["user_departments"] });
    },
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl gradient-primary">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">{L("ฝ่ายงาน", "Departments")}</CardTitle>
              <CardDescription>
                {L("กำหนดฝ่ายและหัวหน้าฝ่ายให้บุคลากร", "Assign departments and heads to staff")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Department overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
        {DEPARTMENTS.map((d) => {
          const count = assignments.filter((a: any) => a.department === d.value).length;
          const heads = assignments.filter((a: any) => a.department === d.value && a.is_head).length;
          return (
            <Card key={d.value} className="card-elevated">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{L(d.th, d.en)}</div>
                <div className="text-2xl font-bold mt-1">{count}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Crown className="h-3 w-3" /> {heads} {L("หัวหน้า", "head")}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-lg">{L("รายชื่อบุคลากร", "Personnel List")}</CardTitle>
            <div className="relative sm:ml-auto sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={L("ค้นหา ชื่อ / รหัส", "Search name / code")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{L("ชื่อ-นามสกุล", "Name")}</TableHead>
                  <TableHead>{L("รหัส", "Code")}</TableHead>
                  <TableHead>{L("บทบาท", "Role")}</TableHead>
                  <TableHead>{L("ฝ่ายที่สังกัด", "Departments")}</TableHead>
                  <TableHead className="text-right">{L("จัดการ", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u: any) => {
                  const userDepts = byUser.get(u.id) || [];
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.prefix || ""}{u.first_name} {u.last_name}
                      </TableCell>
                      <TableCell>{u.employee_code || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userDepts.length === 0 && (
                            <span className="text-xs text-muted-foreground">{L("ยังไม่กำหนด", "Not assigned")}</span>
                          )}
                          {userDepts.map((a: any) => {
                            const meta = DEPARTMENTS.find((d) => d.value === a.department);
                            const posMeta = POSITIONS.find((p) => p.value === (a.position || "member")) || POSITIONS[3];
                            const PosIcon = posMeta.icon;
                            return (
                              <Badge key={a.id} variant={posMeta.variant} className="text-xs gap-1">
                                <PosIcon className="h-3 w-3" />
                                {meta ? L(meta.th, meta.en) : a.department}
                                <span className="opacity-70">· {L(posMeta.th, posMeta.en)}</span>
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                            <UserCog className="h-4 w-4 mr-1" />
                            {L("กำหนด", "Assign")}
                          </Button>
                          {userDepts.length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (await swal.confirm({ title: L("ลบฝ่ายทั้งหมดของผู้ใช้นี้?", "Remove all departments?"), danger: true })) {
                                  removeAll.mutate(u.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {L("ไม่พบข้อมูล", "No data")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SubjectGroupHeadsCard />

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {L("กำหนดฝ่ายให้", "Assign departments to")} {editUser?.prefix || ""}{editUser?.first_name} {editUser?.last_name}
            </DialogTitle>
          <DialogDescription>
            {L("เลือกฝ่ายและตำแหน่ง: หัวหน้า / รอง / ผู้ช่วย / เจ้าหน้าที่", "Pick department and position: head / deputy / assistant / member")}
          </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {DEPARTMENTS.map((d) => (
              <div key={d.value} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedDepts[d.value] || false}
                    onCheckedChange={(c) => setSelectedDepts((s) => ({ ...s, [d.value]: !!c }))}
                  />
                  <Label className="cursor-pointer">{L(d.th, d.en)}</Label>
                </div>
                <Select
                  value={posDepts[d.value] || "member"}
                  disabled={!selectedDepts[d.value]}
                  onValueChange={(v) => setPosDepts((s) => ({ ...s, [d.value]: v as DeptPosition }))}
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {L(p.th, p.en)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>{L("ยกเลิก", "Cancel")}</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? L("กำลังบันทึก...", "Saving...") : L("บันทึก", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
