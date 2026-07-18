import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { BookOpenCheck, Crown, UserPlus, Trash2, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { swal } from "@/lib/swal";

export const SUBJECT_GROUPS = [
  { value: "thai", th: "ภาษาไทย", en: "Thai Language" },
  { value: "math", th: "คณิตศาสตร์", en: "Mathematics" },
  { value: "science", th: "วิทยาศาสตร์และเทคโนโลยี", en: "Science & Technology" },
  { value: "social", th: "สังคมศึกษา ศาสนา และวัฒนธรรม", en: "Social Studies" },
  { value: "health_pe", th: "สุขศึกษาและพลศึกษา", en: "Health & PE" },
  { value: "arts", th: "ศิลปะ", en: "Arts" },
  { value: "occupation", th: "การงานอาชีพ", en: "Occupations" },
  { value: "foreign_lang", th: "ภาษาต่างประเทศ", en: "Foreign Languages" },
  { value: "special_ed", th: "งานเด็กพิเศษ", en: "Special Education" },
] as const;

type GroupValue = typeof SUBJECT_GROUPS[number]["value"];

export default function SubjectGroupHeadsCard() {
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "en" ? en : th);
  const qc = useQueryClient();
  const [openGroup, setOpenGroup] = useState<GroupValue | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-for-heads"],
    queryFn: async () => {
      // Pull from personnel (source of truth for teachers) + profiles fallback
      const [perRes, profRes, rolesRes] = await Promise.all([
        supabase
          .from("personnel")
          .select("id, user_id, prefix, first_name, last_name, employee_code, position, subject_group")
          .eq("status", "active"),
        supabase
          .from("profiles")
          .select("id, first_name, last_name, employee_code"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const profMap = new Map((profRes.data || []).map((p: any) => [p.id, p]));
      const roleMap = new Map((rolesRes.data || []).map((r: any) => [r.user_id, r.role]));
      const merged = new Map<string, any>();
      // personnel with linked auth user
      for (const p of perRes.data || []) {
        if (!p.user_id) continue;
        const prof: any = profMap.get(p.user_id) || {};
        merged.set(p.user_id, {
          id: p.user_id,
          prefix: p.prefix || "",
          first_name: p.first_name || prof.first_name || "",
          last_name: p.last_name || prof.last_name || "",
          employee_code: p.employee_code || prof.employee_code || "",
          role: roleMap.get(p.user_id) || "teacher",
        });
      }
      // also include any profile with a non-student role (admins/directors without personnel row)
      for (const prof of profRes.data || []) {
        if (merged.has(prof.id)) continue;
        const role = roleMap.get(prof.id);
        if (!role || ["student", "alumni", "parent"].includes(role)) continue;
        merged.set(prof.id, { ...prof, role });
      }
      return Array.from(merged.values()).sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "th")
      );
    },
  });

  const { data: heads = [] } = useQuery({
    queryKey: ["subject_group_heads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_group_heads")
        .select("*")
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const userMap = useMemo(() => new Map(staff.map((s: any) => [s.id, s])), [staff]);
  const headsByGroup = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const h of heads) {
      const arr = m.get(h.subject_group) || [];
      arr.push(h);
      m.set(h.subject_group, arr);
    }
    return m;
  }, [heads]);

  const assignMut = useMutation({
    mutationFn: async () => {
      if (!openGroup || !selectedUser) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("subject_group_heads").insert({
        subject_group: openGroup,
        user_id: selectedUser,
        assigned_by: user?.id,
        notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(L("กำหนดหัวหน้ากลุ่มสาระเรียบร้อย", "Head assigned"));
      qc.invalidateQueries({ queryKey: ["subject_group_heads"] });
      setOpenGroup(null);
      setSelectedUser("");
      setNotes("");
      setSearch("");
    },
    onError: (e: any) => {
      if (String(e?.message || "").includes("duplicate"))
        toast.error(L("ผู้ใช้นี้เป็นหัวหน้ากลุ่มนี้อยู่แล้ว", "Already a head of this group"));
      else toast.error(e?.message || "Failed");
    },
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subject_group_heads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(L("ลบหัวหน้ากลุ่มสาระแล้ว", "Head removed"));
      qc.invalidateQueries({ queryKey: ["subject_group_heads"] });
    },
  });

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s: any) =>
      `${s.first_name} ${s.last_name} ${s.employee_code || ""}`.toLowerCase().includes(q)
    );
  }, [staff, search]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl gradient-primary">
            <BookOpenCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">
              {L("หัวหน้ากลุ่มสาระการเรียนรู้", "Subject Group Heads")}
            </CardTitle>
            <CardDescription>
              {L(
                "กำหนดหัวหน้ากลุ่มสาระ 8 กลุ่ม + งานเด็กพิเศษ เพื่อดำเนินการเอกสารงานวิชาการ",
                "Assign heads for the 8 subject groups + special education for academic document workflows"
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SUBJECT_GROUPS.map((g) => {
            const list = headsByGroup.get(g.value) || [];
            return (
              <Card key={g.value} className="card-elevated">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{L(g.th, g.en)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {list.length} {L("คน", "person(s)")}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setOpenGroup(g.value);
                        setSelectedUser("");
                        setNotes("");
                        setSearch("");
                      }}
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" />
                      {L("เพิ่ม", "Add")}
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {list.length === 0 && (
                      <div className="text-xs text-muted-foreground italic">
                        {L("ยังไม่ได้กำหนดหัวหน้า", "No head assigned")}
                      </div>
                    )}
                    {list.map((h: any) => {
                      const u = userMap.get(h.user_id);
                      return (
                        <div key={h.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40">
                          <div className="flex items-center gap-2 min-w-0">
                            <Crown className="h-3.5 w-3.5 text-warning shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm truncate">
                                {u ? `${u.prefix || ""}${u.first_name} ${u.last_name}` : h.user_id.slice(0, 8)}
                              </div>
                              {h.notes && (
                                <div className="text-xs text-muted-foreground truncate">{h.notes}</div>
                              )}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={async () => {
                              if (await swal.confirm({
                                title: L("ลบหัวหน้ากลุ่มสาระนี้?", "Remove this head?"),
                                danger: true,
                              })) removeMut.mutate(h.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CardContent>

      <Dialog open={!!openGroup} onOpenChange={(o) => !o && setOpenGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {L("กำหนดหัวหน้ากลุ่มสาระ", "Assign Subject Group Head")}
            </DialogTitle>
            <DialogDescription>
              {openGroup &&
                L(
                  `กลุ่มสาระ: ${SUBJECT_GROUPS.find((g) => g.value === openGroup)?.th}`,
                  `Group: ${SUBJECT_GROUPS.find((g) => g.value === openGroup)?.en}`
                )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{L("ค้นหาบุคลากร", "Search staff")}</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={L("ชื่อ หรือ รหัส", "Name or code")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label>{L("เลือกบุคลากร", "Select staff")}</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={L("เลือก...", "Select...")} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {filteredStaff.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.prefix || ""}{s.first_name} {s.last_name}
                      {s.employee_code ? ` (${s.employee_code})` : ""}
                      {s.role ? ` · ${s.role}` : ""}
                    </SelectItem>
                  ))}
                  {filteredStaff.length === 0 && (
                    <div className="text-xs text-muted-foreground p-3 text-center">
                      {L("ไม่พบข้อมูล", "No data")}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{L("หมายเหตุ (ไม่บังคับ)", "Notes (optional)")}</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={L("เช่น ปีการศึกษา 2568", "e.g. AY 2025")}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenGroup(null)}>
              {L("ยกเลิก", "Cancel")}
            </Button>
            <Button
              onClick={() => assignMut.mutate()}
              disabled={!selectedUser || assignMut.isPending}
            >
              {assignMut.isPending ? L("กำลังบันทึก...", "Saving...") : L("บันทึก", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
