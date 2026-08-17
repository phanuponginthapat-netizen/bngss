import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, BookOpen, Plus, Trash2, Crown } from "lucide-react";
import { DEPT_ROLE_LABEL_TH, type SchoolDepartment, type DeptRole } from "@/hooks/useUserDepartments";
import { SUBJECT_GROUPS } from "@/hooks/useUserSubjectGroups";
import { swal } from "@/lib/swal";
const showSuccess = (t: string) => swal.success(t);
const showError = (t: string) => swal.error(t);
const confirmAction = (t: string) => swal.confirm({ title: t, danger: true });

const DEPARTMENTS: { value: SchoolDepartment; label: string }[] = [
  { value: "academic", label: "ฝ่ายวิชาการ" },
  { value: "student_affairs", label: "ฝ่ายกิจการนักเรียน" },
  { value: "general_admin", label: "ฝ่ายบริหารทั่วไป" },
  { value: "finance_personnel", label: "ฝ่ายงบประมาณและบุคลากร" },
  { value: "director_office", label: "สำนักงานผู้อำนวยการ" },
];

const DEPT_ROLES: DeptRole[] = ["member", "head", "deputy_head", "section_head"];

/**
 * Profile card for teachers/directors to self-declare their departments and
 * subject groups, including leadership level (head/deputy/section head).
 */
export default function MyMembershipsCard() {
  const { session } = useAuthSession();
  const uid = session?.user?.id;
  const qc = useQueryClient();

  const [newGroup, setNewGroup] = useState<string>("");
  const [newGroupRole, setNewGroupRole] = useState<DeptRole>("member");

  const depts = useQuery({
    queryKey: ["profile-my-depts", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_departments")
        .select("id, department, dept_role, is_head")
        .eq("user_id", uid!);
      return data || [];
    },
  });

  const groups = useQuery({
    queryKey: ["profile-my-groups", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_subject_groups")
        .select("id, subject_group, group_role")
        .eq("user_id", uid!);
      return data || [];
    },
  });

  const addGroup = useMutation({
    mutationFn: async () => {
      if (!uid || !newGroup) throw new Error("เลือกกลุ่มสาระก่อน");
      const { error } = await supabase.from("user_subject_groups").insert({
        user_id: uid,
        subject_group: newGroup,
        group_role: newGroupRole,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("เพิ่มกลุ่มสาระสำเร็จ");
      setNewGroup(""); setNewGroupRole("member");
      qc.invalidateQueries({ queryKey: ["profile-my-groups", uid] });
      qc.invalidateQueries({ queryKey: ["my-subject-groups", uid] });
    },
    onError: (e: any) => showError(e?.message || "เพิ่มไม่สำเร็จ"),
  });

  const updateGroupRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: DeptRole }) => {
      const { error } = await supabase
        .from("user_subject_groups")
        .update({ group_role: role } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-my-groups", uid] });
      qc.invalidateQueries({ queryKey: ["my-subject-groups", uid] });
    },
    onError: (e: any) => showError(e?.message || "ปรับระดับไม่สำเร็จ"),
  });

  const removeGroup = useMutation({
    mutationFn: async (id: string) => {
      const ok = await confirmAction("ลบกลุ่มสาระนี้?");
      if (!ok) return;
      const { error } = await supabase.from("user_subject_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile-my-groups", uid] });
      qc.invalidateQueries({ queryKey: ["my-subject-groups", uid] });
    },
    onError: (e: any) => showError(e?.message || "ลบไม่สำเร็จ"),
  });

  const usedGroups = new Set((groups.data || []).map((g: any) => g.subject_group));

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Crown className="w-4 h-4 text-primary" /> ฝ่ายงาน & กลุ่มสาระของฉัน
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          เพิ่ม/ปรับตำแหน่งในฝ่ายและกลุ่มสาระที่คุณสังกัด รวมถึงระดับ หัวหน้า/รอง/หัวหน้าหมวด
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Departments (read-only — assigned by admin/director) */}
        <section className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> ฝ่ายงาน
          </h4>
          <div className="space-y-2">
            {(depts.data || []).map((d: any) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 p-2 rounded-lg border bg-muted/20">
                <Badge variant="secondary" className="font-medium">
                  {DEPARTMENTS.find(x => x.value === d.department)?.label || d.department}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {DEPT_ROLE_LABEL_TH[d.dept_role as DeptRole] || d.dept_role}
                </span>
              </div>
            ))}
            {(depts.data || []).length === 0 && (
              <p className="text-xs text-muted-foreground italic">ยังไม่ได้เพิ่มฝ่าย</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground pt-2 border-t">
            การกำหนดฝ่ายงานและตำแหน่ง (หัวหน้า/รอง/หัวหน้าหมวด) ทำได้โดยผู้ดูแลระบบหรือผู้อำนวยการเท่านั้น
          </p>
        </section>


        {/* Subject Groups */}
        <section className="space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> กลุ่มสาระการเรียนรู้
          </h4>
          <div className="space-y-2">
            {(groups.data || []).map((g: any) => (
              <div key={g.id} className="flex flex-wrap items-center gap-2 p-2 rounded-lg border bg-muted/20">
                <Badge variant="secondary" className="font-medium">{g.subject_group}</Badge>
                <Select value={g.group_role} onValueChange={(v: DeptRole) => updateGroupRole.mutate({ id: g.id, role: v })}>
                  <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEPT_ROLES.map(r => <SelectItem key={r} value={r}>{DEPT_ROLE_LABEL_TH[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => removeGroup.mutate(g.id)} className="ml-auto text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {(groups.data || []).length === 0 && (
              <p className="text-xs text-muted-foreground italic">ยังไม่ได้เพิ่มกลุ่มสาระ</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Select value={newGroup} onValueChange={setNewGroup}>
              <SelectTrigger className="w-[240px] h-9"><SelectValue placeholder="เลือกกลุ่มสาระที่จะเพิ่ม" /></SelectTrigger>
              <SelectContent>
                {SUBJECT_GROUPS.filter(g => !usedGroups.has(g)).map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newGroupRole} onValueChange={(v: DeptRole) => setNewGroupRole(v)}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPT_ROLES.map(r => <SelectItem key={r} value={r}>{DEPT_ROLE_LABEL_TH[r]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => addGroup.mutate()} disabled={!newGroup || addGroup.isPending}>
              <Plus className="w-4 h-4 mr-1" /> เพิ่มกลุ่มสาระ
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
