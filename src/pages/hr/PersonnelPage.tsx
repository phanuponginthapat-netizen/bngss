import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Search, Building2, UserCheck, TrendingUp, AlertTriangle, Crown } from "lucide-react";
import DepartmentManagementPage from "@/pages/admin/DepartmentManagementPage";

import { CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// Position types for workforce planning
const POSITION_TYPES = [
  { type: "ผู้อำนวยการ", required: 1 },
  { type: "รองผู้อำนวยการ", required: 2 },
  { type: "ครู คศ.3", required: 0 },
  { type: "ครู คศ.2", required: 0 },
  { type: "ครู คศ.1", required: 0 },
  { type: "ครูผู้ช่วย", required: 0 },
  { type: "พนักงานราชการ", required: 0 },
  { type: "ลูกจ้างชั่วคราว", required: 0 },
  { type: "ครูอัตราจ้าง", required: 0 },
  { type: "นักการภารโรง", required: 1 },
];

const PersonnelPage = () => {
  const { lang } = useLanguage();
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("personnel");

  const { data: profiles = [], isLoading: profilesLoading, isError: profilesError } = useQuery({
    queryKey: ["personnel-profiles-directory"],
    queryFn: async () => {
      // Try direct query (admin/director see full PII), fall back to safe RPC for other roles
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, phone, avatar_url, employee_code, position_title, department, gender, date_of_birth, address, line_id, emergency_contact, emergency_phone, blood_type, hire_date, leave_date, education_history, work_history")
        .order("first_name");
      if (!error && data && data.length > 0) return data;
      const { data: dir, error: rpcErr } = await (supabase.rpc as any)("get_personnel_directory");
      if (rpcErr) throw rpcErr;
      return dir || [];
    },
  });

  const { data: userRoles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: personnelData = [], isLoading: personnelLoading, isError: personnelError } = useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const { data, error } = await supabase.from("personnel").select("*").order("employee_code");
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = profilesLoading || rolesLoading || personnelLoading;
  const isError = profilesError || personnelError;

  const staffRoles = ["admin", "teacher", "director"];
  const staffUserIds = userRoles.filter((r: any) => staffRoles.includes(r.role)).map((r: any) => r.user_id);

  const getNormalizedPosition = (profile: any, personnel: any, role: string) => {
    const rawPosition = profile.position_title || personnel?.position || "";
    const academicStanding = personnel?.academic_standing || "";
    const combined = `${rawPosition} ${academicStanding}`;

    if (combined.includes("รองผู้อำนวยการ") || combined.includes("รองผอ")) return "รองผู้อำนวยการ";
    if (combined.includes("ผู้อำนวยการ")) return "ผู้อำนวยการ";
    if (combined.includes("คศ.3")) return "ครู คศ.3";
    if (combined.includes("คศ.2")) return "ครู คศ.2";
    if (combined.includes("คศ.1")) return "ครู คศ.1";
    if (combined.includes("ครูผู้ช่วย")) return "ครูผู้ช่วย";
    if (combined.includes("พนักงานราชการ")) return "พนักงานราชการ";
    if (combined.includes("ลูกจ้างชั่วคราว")) return "ลูกจ้างชั่วคราว";
    if (combined.includes("ครูอัตราจ้าง")) return "ครูอัตราจ้าง";
    if (combined.includes("นักการภารโรง")) return "นักการภารโรง";
    if (role === "director") return rawPosition?.includes("รอง") ? "รองผู้อำนวยการ" : "ผู้อำนวยการ";
    if (role === "admin") return rawPosition || "ผู้ดูแลระบบ";
    return rawPosition || "ครู";
  };

  const profileMatchedPersonnelIds = new Set<string>();
  const profileBased = profiles
    .filter((p: any) => staffUserIds.includes(p.id))
    .map((p: any) => {
      const role = userRoles.find((r: any) => r.user_id === p.id);
      const personnel = personnelData.find((pd: any) =>
        (p.employee_code && pd.employee_code === p.employee_code) ||
        ((!p.employee_code || p.employee_code === "-") && pd.first_name === p.first_name && pd.last_name === p.last_name)
      );
      if (personnel?.id) profileMatchedPersonnelIds.add(personnel.id);

      return {
        ...p,
        role: role?.role || "teacher",
        position: getNormalizedPosition(p, personnel, role?.role || "teacher"),
        dept: p.department || personnel?.department || "-",
        employeeCode: p.employee_code || personnel?.employee_code || "-",
        personnelStatus: personnel?.status || "active",
        hireDate: p.hire_date || personnel?.hire_date,
        leaveDate: p.leave_date,
      };
    });

  // Include standalone personnel records (no linked auth profile) e.g. seeded data
  const standalonePersonnel = personnelData
    .filter((pd: any) => !profileMatchedPersonnelIds.has(pd.id) && !pd.user_id)
    .map((pd: any) => {
      const role = (pd.position || "").includes("ผู้อำนวยการ") ? "director" : "teacher";
      return {
        id: `personnel-${pd.id}`,
        first_name: pd.first_name,
        last_name: pd.last_name,
        phone: pd.phone,
        avatar_url: null,
        employee_code: pd.employee_code,
        position_title: pd.position,
        department: pd.department,
        gender: pd.gender,
        date_of_birth: pd.date_of_birth,
        address: pd.address,
        role,
        position: getNormalizedPosition({ position_title: pd.position }, pd, role),
        dept: pd.department || "-",
        employeeCode: pd.employee_code || "-",
        personnelStatus: pd.status || "active",
        hireDate: pd.hire_date,
        leaveDate: null,
      };
    });

  const mergedStaff = [...profileBased, ...standalonePersonnel];

  const DEPARTMENTS = [...new Set(mergedStaff.map((s: any) => s.dept).filter(Boolean))].sort();

  const filtered = mergedStaff.filter((s: any) => {
    if (search && !s.first_name?.includes(search) && !s.last_name?.includes(search) && !s.employeeCode?.includes(search)) return false;
    if (deptFilter !== "all" && s.dept !== deptFilter) return false;
    return true;
  });

  const roleLabel = (r: string, position?: string) => {
    if (r === "director" && position?.includes("รอง")) return "รองผู้อำนวยการ";
    const map: Record<string, string> = { admin: "ผู้ดูแลระบบ", teacher: "ครู", director: "ผู้อำนวยการ" };
    return map[r] || r;
  };

  const roleColor = (r: string) => {
    const map: Record<string, string> = {
      admin: "bg-danger-soft text-danger",
      director: "bg-info-soft text-info",
      teacher: "bg-info-soft text-info",
    };
    return map[r] || "";
  };

  // Workforce planning calculations
  const positionCounts = POSITION_TYPES.map((pt) => {
    const count = mergedStaff.filter((s: any) => s.position === pt.type).length;
    return { ...pt, current: count };
  });

  const totalPositions = mergedStaff.length;
  const activeCount = mergedStaff.filter((s: any) => !s.leaveDate).length;
  const retiringSoon = mergedStaff.filter((s: any) => {
    if (!s.date_of_birth) return false;
    const age = new Date().getFullYear() - new Date(s.date_of_birth).getFullYear();
    return age >= 58;
  }).length;

  if (isError) {
    return (
      <div className="p-6">
        <Card className="border-destructive/30"><CardContent className="py-8 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 mx-auto text-destructive" />
          <p className="font-semibold">โหลดข้อมูลบุคลากรไม่สำเร็จ</p>
          <p className="text-sm text-muted-foreground">โปรดลองรีเฟรชหน้านี้</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {isLoading && (
        <div className="text-xs text-muted-foreground animate-pulse">กำลังโหลดข้อมูลบุคลากร...</div>
      )}
      <Card className="card-gradient border-0">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl gradient-primary">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl">{lang === "th" ? "บุคลากร" : "Personnel"}</CardTitle>
              <CardDescription>
                {lang === "th" ? "ประวัติ ฝ่ายงาน วุฒิการศึกษา และอัตรากำลัง (P-OBEC)" : "Profiles, departments, education and workforce (P-OBEC)"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="personnel"><Users className="w-4 h-4 mr-1" /> ข้อมูลบุคลากร</TabsTrigger>
          <TabsTrigger value="workforce"><TrendingUp className="w-4 h-4 mr-1" /> อัตรากำลัง</TabsTrigger>
          <TabsTrigger value="departments"><Crown className="w-4 h-4 mr-1" /> ฝ่าย & หัวหน้าหมวด</TabsTrigger>
        </TabsList>

        <TabsContent value="personnel" className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">บุคลากรทั้งหมด</p><p className="text-2xl font-bold text-primary">{mergedStaff.length}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">ครูผู้สอน</p><p className="text-2xl font-bold text-info">{mergedStaff.filter((s: any) => s.role === "teacher").length}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">ผู้บริหาร</p><p className="text-2xl font-bold text-info">{mergedStaff.filter((s: any) => s.role === "director").length}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">ฝ่ายงาน</p><p className="text-2xl font-bold text-foreground">{DEPARTMENTS.length}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">ใกล้เกษียณ</p><p className="text-2xl font-bold text-warning">{retiringSoon}</p></CardContent></Card>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="ค้นหาจากชื่อหรือรหัส..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-full sm:w-[200px]"><Building2 className="w-4 h-4 mr-2" /><SelectValue placeholder="ฝ่ายงาน" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกฝ่าย</SelectItem>
                {DEPARTMENTS.map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อ-สกุล</TableHead>
                <TableHead>ตำแหน่ง</TableHead>
                <TableHead>ฝ่าย</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead>วันที่เข้า</TableHead>
                <TableHead>โทร</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.employeeCode}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">{(s.first_name || "?")[0]}</div>
                        )}
                        <span className="whitespace-nowrap">{s.first_name} {s.last_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{s.position}</TableCell>
                    <TableCell>{s.dept}</TableCell>
                    <TableCell><Badge className={roleColor(s.role)}>{roleLabel(s.role, s.position)}</Badge></TableCell>
                    <TableCell className="text-xs">{s.hireDate ? new Date(s.hireDate).toLocaleDateString("th-TH") : "-"}</TableCell>
                    <TableCell>{s.phone || "-"}</TableCell>
                    <TableCell>
                      {s.leaveDate ? (
                        <Badge variant="outline" className="text-muted-foreground">พ้นราชการ</Badge>
                      ) : (
                        <Badge className="bg-success-soft text-success">ปฏิบัติงาน</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="workforce" className="space-y-6">
          {/* Workforce Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6 text-center">
              <UserCheck className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">อัตรากำลังปัจจุบัน</p>
              <p className="text-3xl font-bold text-primary">{activeCount}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <Users className="w-8 h-8 text-info mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">ทั้งหมด (รวมพ้นราชการ)</p>
              <p className="text-3xl font-bold">{totalPositions}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">ใกล้เกษียณ (อายุ ≥ 58)</p>
              <p className="text-3xl font-bold text-warning">{retiringSoon}</p>
            </CardContent></Card>
            <Card><CardContent className="pt-6 text-center">
              <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">จำนวนฝ่ายงาน</p>
              <p className="text-3xl font-bold">{DEPARTMENTS.length}</p>
            </CardContent></Card>
          </div>

          {/* Position Type Breakdown */}
          <Card>
            <CardHeader><CardTitle className="text-base">สรุปอัตรากำลังตามตำแหน่ง/ประเภท</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>ประเภทตำแหน่ง</TableHead>
                  <TableHead className="text-center">จำนวนปัจจุบัน</TableHead>
                  <TableHead className="text-center">กราฟ</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {positionCounts.map((pt) => (
                    <TableRow key={pt.type}>
                      <TableCell className="font-medium">{pt.type}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{pt.current} คน</Badge>
                      </TableCell>
                      <TableCell>
                        <Progress value={activeCount > 0 ? (pt.current / activeCount) * 100 : 0} className="h-3" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Department Breakdown */}
          <Card>
            <CardHeader><CardTitle className="text-base">อัตรากำลังตามฝ่ายงาน</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {DEPARTMENTS.map((dept: string) => {
                  const count = mergedStaff.filter((s: any) => s.dept === dept && !s.leaveDate).length;
                  return (
                    <div key={dept} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{dept}</p>
                        <p className="text-sm text-muted-foreground">{count} คน</p>
                      </div>
                      <Progress value={activeCount > 0 ? (count / activeCount) * 100 : 0} className="w-24 h-3" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="space-y-6">
          <DepartmentManagementPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PersonnelPage;
