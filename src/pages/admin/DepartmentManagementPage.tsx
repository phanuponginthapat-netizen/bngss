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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Building2, Search, UserCog, Crown, Star, Bookmark, Trash2, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { swal } from "@/lib/swal";
import { SUBJECT_GROUPS } from "@/hooks/useUserSubjectGroups";
import type { DeptRole } from "@/hooks/useUserDepartments";

const DEPARTMENTS = [
  { value: "academic", th: "ฝ่ายวิชาการ", en: "Academic Affairs" },
  { value: "student_affairs", th: "ฝ่ายกิจการนักเรียน", en: "Student Affairs" },
  { value: "general_admin", th: "ฝ่ายบริหารงานทั่วไป", en: "General Administration" },
  { value: "finance_personnel", th: "ฝ่ายงบประมาณและบุคคล", en: "Finance & Personnel" },
  { value: "director_office", th: "สำนักผู้อำนวยการ", en: "Director's Office" },
] as const;

type DeptValue = typeof DEPARTMENTS[number]["value"];

const ROLE_META: Record<DeptRole, { th: string; en: string; icon: any; className: string }> = {
  member:       { th: "สมาชิก",      en: "Member",        icon: UserCog,  className: "bg-slate-500/15 text-slate-600 dark:text-slate-300 ring-1 ring-slate-500/20" },
  section_head: { th: "หัวหน้าหมวด", en: "Section Head",  icon: Bookmark, className: "bg-blue-500/15 text-blue-600 dark:text-blue-300 ring-1 ring-blue-500/25" },
  deputy_head:  { th: "รองหัวหน้าฝ่าย", en: "Deputy Head", icon: Star,    className: "bg-violet-500/15 text-violet-600 dark:text-violet-300 ring-1 ring-violet-500/25" },
  head:         { th: "หัวหน้าฝ่าย",  en: "Head",          icon: Crown,   className: "bg-amber-500/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30" },
};

function RoleBadge({ role, lang }: { role: DeptRole; lang: "th" | "en" }) {
  const m = ROLE_META[role];
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${m.className}`}>
      <Icon className="h-3 w-3" />
      {lang === "th" ? m.th : m.en}
    </span>
  );
}

export default function DepartmentManagementPage() {
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "en" ? en : th);
  const qc = useQueryClient();

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

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl gradient-primary">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">{L("โครงสร้างบุคลากร", "Personnel Structure")}</CardTitle>
              <CardDescription>
                {L(
                  "กำหนดฝ่ายงาน · กลุ่มสาระ · ตำแหน่ง (หัวหน้า/รอง/หัวหน้าหมวด/สมาชิก) ให้บุคลากร",
                  "Assign departments, subject groups, and roles (head / deputy / section head / member)"
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="departments">
        <TabsList className="grid grid-cols-1 sm:grid-cols-2 w-full max-w-md">
          <TabsTrigger value="departments" className="gap-1.5">
            <Building2 className="h-4 w-4" />
            {L("ฝ่ายงาน", "Departments")}
          </TabsTrigger>
          <TabsTrigger value="subject_groups" className="gap-1.5">
            <BookOpen className="h-4 w-4" />
            {L("กลุ่มสาระการเรียนรู้", "Subject Groups")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="mt-4">
          <DepartmentsTab users={users} lang={lang} L={L} qc={qc} />
        </TabsContent>

        <TabsContent value="subject_groups" className="mt-4">
          <SubjectGroupsTab users={users} lang={lang} L={L} qc={qc} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== FACTIONS (ฝ่ายงาน) ============================== */

function DepartmentsTab({ users, lang, L, qc }: any) {
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<any | null>(null);
  const [selected, setSelected] = useState<Record<DeptValue, boolean>>({} as any);
  const [roleMap, setRoleMap] = useState<Record<DeptValue, DeptRole>>({} as any);

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
    const sel: any = {}, rm: any = {};
    for (const d of DEPARTMENTS) {
      const found = current.find((c: any) => c.department === d.value);
      sel[d.value] = !!found;
      rm[d.value] = (found?.dept_role as DeptRole) || "member";
    }
    setSelected(sel);
    setRoleMap(rm);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      const current = byUser.get(editUser.id) || [];
      const currentMap = new Map(current.map((c: any) => [c.department, c]));
      const ops: PromiseLike<any>[] = [];

      for (const d of DEPARTMENTS) {
        const want = selected[d.value];
        const wantRole = roleMap[d.value] || "member";
        const existing = currentMap.get(d.value);
        if (want && !existing) {
          ops.push(
            supabase.from("user_departments").insert({
              user_id: editUser.id,
              department: d.value as any,
              dept_role: wantRole,
            })
          );
        } else if (!want && existing) {
          ops.push(supabase.from("user_departments").delete().eq("id", (existing as any).id));
        } else if (want && existing && (existing as any).dept_role !== wantRole) {
          ops.push(
            supabase.from("user_departments").update({ dept_role: wantRole }).eq("id", (existing as any).id)
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
        {DEPARTMENTS.map((d) => {
          const items = assignments.filter((a: any) => a.department === d.value);
          const heads = items.filter((a: any) => a.dept_role === "head").length;
          const deputies = items.filter((a: any) => a.dept_role === "deputy_head").length;
          const sections = items.filter((a: any) => a.dept_role === "section_head").length;
          return (
            <Card key={d.value} className="card-elevated">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{L(d.th, d.en)}</div>
                <div className="text-2xl font-bold mt-1">{items.length}</div>
                <div className="flex flex-wrap gap-1 mt-2 text-[10px]">
                  {heads > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">👑 {heads}</span>}
                  {deputies > 0 && <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300">★ {deputies}</span>}
                  {sections > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300">§ {sections}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-lg">{L("รายชื่อบุคลากร", "Personnel")}</CardTitle>
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
                  <TableHead>{L("ฝ่าย · ตำแหน่ง", "Departments · Role")}</TableHead>
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
                        <div className="flex flex-wrap gap-1.5">
                          {userDepts.length === 0 && (
                            <span className="text-xs text-muted-foreground">{L("ยังไม่กำหนด", "Not assigned")}</span>
                          )}
                          {userDepts.map((a: any) => {
                            const meta = DEPARTMENTS.find((d) => d.value === a.department);
                            return (
                              <div key={a.id} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-muted/60 ring-1 ring-border/60">
                                <span className="text-xs font-medium">{meta ? L(meta.th, meta.en) : a.department}</span>
                                <RoleBadge role={(a.dept_role as DeptRole) || "member"} lang={lang} />
                              </div>
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
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {L("ไม่พบข้อมูล", "No data")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {L("กำหนดฝ่ายให้", "Assign departments to")} {editUser?.prefix || ""}{editUser?.first_name} {editUser?.last_name}
            </DialogTitle>
            <DialogDescription>
              {L("เลือกฝ่ายที่สังกัด และกำหนดตำแหน่งในแต่ละฝ่าย", "Pick departments and set the role in each")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {DEPARTMENTS.map((d) => {
              const enabled = selected[d.value];
              return (
                <div key={d.value} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                  <Checkbox
                    checked={enabled || false}
                    onCheckedChange={(c) => setSelected((s) => ({ ...s, [d.value]: !!c }))}
                  />
                  <Label className="cursor-pointer flex-1">{L(d.th, d.en)}</Label>
                  <Select
                    value={roleMap[d.value] || "member"}
                    onValueChange={(v) => setRoleMap((s) => ({ ...s, [d.value]: v as DeptRole }))}
                    disabled={!enabled}
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["head", "deputy_head", "section_head", "member"] as DeptRole[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {L(ROLE_META[r].th, ROLE_META[r].en)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
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

/* ============================== SUBJECT GROUPS (กลุ่มสาระ) ============================== */

function SubjectGroupsTab({ users, lang, L, qc }: any) {
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<any | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [roleMap, setRoleMap] = useState<Record<string, DeptRole>>({});

  const { data: assignments = [] } = useQuery({
    queryKey: ["user_subject_groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_subject_groups").select("*");
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
    const sel: any = {}, rm: any = {};
    for (const g of SUBJECT_GROUPS) {
      const found = current.find((c: any) => c.subject_group === g);
      sel[g] = !!found;
      rm[g] = (found?.group_role as DeptRole) || "member";
    }
    setSelected(sel);
    setRoleMap(rm);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      const current = byUser.get(editUser.id) || [];
      const currentMap = new Map(current.map((c: any) => [c.subject_group, c]));
      const ops: PromiseLike<any>[] = [];

      for (const g of SUBJECT_GROUPS) {
        const want = selected[g];
        const wantRole = roleMap[g] || "member";
        const existing = currentMap.get(g);
        if (want && !existing) {
          ops.push(
            supabase.from("user_subject_groups").insert({
              user_id: editUser.id,
              subject_group: g,
              group_role: wantRole,
            })
          );
        } else if (!want && existing) {
          ops.push(supabase.from("user_subject_groups").delete().eq("id", (existing as any).id));
        } else if (want && existing && (existing as any).group_role !== wantRole) {
          ops.push(
            supabase.from("user_subject_groups").update({ group_role: wantRole }).eq("id", (existing as any).id)
          );
        }
      }
      const results = await Promise.all(ops);
      const err = results.find((r: any) => r?.error);
      if (err) throw (err as any).error;
    },
    onSuccess: () => {
      toast.success(L("บันทึกกลุ่มสาระเรียบร้อย", "Subject groups saved"));
      qc.invalidateQueries({ queryKey: ["user_subject_groups"] });
      setEditUser(null);
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  const removeAll = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_subject_groups").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(L("ลบกลุ่มสาระทั้งหมดแล้ว", "All groups removed"));
      qc.invalidateQueries({ queryKey: ["user_subject_groups"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {SUBJECT_GROUPS.map((g) => {
          const items = assignments.filter((a: any) => a.subject_group === g);
          const heads = items.filter((a: any) => a.group_role === "head").length;
          return (
            <Card key={g} className="card-elevated">
              <CardContent className="p-3">
                <div className="text-[11px] text-muted-foreground line-clamp-2 min-h-[28px]">{g}</div>
                <div className="text-xl font-bold mt-1">{items.length}</div>
                {heads > 0 && (
                  <div className="text-[10px] mt-1 flex items-center gap-1 text-amber-700 dark:text-amber-300">
                    <Crown className="h-3 w-3" /> {heads} {L("หัวหน้าหมวด", "head")}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-lg">{L("รายชื่อบุคลากร", "Personnel")}</CardTitle>
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
                  <TableHead>{L("กลุ่มสาระ · ตำแหน่ง", "Subject Groups · Role")}</TableHead>
                  <TableHead className="text-right">{L("จัดการ", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u: any) => {
                  const list = byUser.get(u.id) || [];
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.prefix || ""}{u.first_name} {u.last_name}
                      </TableCell>
                      <TableCell>{u.employee_code || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {list.length === 0 && (
                            <span className="text-xs text-muted-foreground">{L("ยังไม่กำหนด", "Not assigned")}</span>
                          )}
                          {list.map((a: any) => (
                            <div key={a.id} className="flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-muted/60 ring-1 ring-border/60">
                              <span className="text-xs font-medium">{a.subject_group}</span>
                              <RoleBadge role={(a.group_role as DeptRole) || "member"} lang={lang} />
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                            <UserCog className="h-4 w-4 mr-1" />
                            {L("กำหนด", "Assign")}
                          </Button>
                          {list.length > 0 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (await swal.confirm({ title: L("ลบกลุ่มสาระทั้งหมด?", "Remove all groups?"), danger: true })) {
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
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {L("กำหนดกลุ่มสาระให้", "Assign subject groups to")} {editUser?.prefix || ""}{editUser?.first_name} {editUser?.last_name}
            </DialogTitle>
            <DialogDescription>
              {L("เลือกกลุ่มสาระที่สังกัด และกำหนดตำแหน่ง", "Pick subject groups and set the role")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {SUBJECT_GROUPS.map((g) => {
              const enabled = selected[g];
              return (
                <div key={g} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                  <Checkbox
                    checked={enabled || false}
                    onCheckedChange={(c) => setSelected((s) => ({ ...s, [g]: !!c }))}
                  />
                  <Label className="cursor-pointer flex-1 text-sm">{g}</Label>
                  <Select
                    value={roleMap[g] || "member"}
                    onValueChange={(v) => setRoleMap((s) => ({ ...s, [g]: v as DeptRole }))}
                    disabled={!enabled}
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["head", "deputy_head", "section_head", "member"] as DeptRole[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {L(ROLE_META[r].th, ROLE_META[r].en)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
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
