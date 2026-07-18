import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

const ROLES = ["admin", "director", "teacher", "student", "parent", "alumni"] as const;
const CATEGORIES = [
  { key: "critical",   label: "เร่งด่วน / ฉุกเฉิน" },
  { key: "attendance", label: "เข้าเรียน / สแกนหน้า" },
  { key: "behavior",   label: "พฤติกรรม" },
  { key: "health",     label: "สุขภาพ / วัคซีน" },
  { key: "homework",   label: "การบ้าน / งาน" },
  { key: "score",      label: "คะแนน / ผลการเรียน" },
  { key: "eform",      label: "แบบฟอร์ม E-Form" },
  { key: "leave",      label: "การลา" },
  { key: "ict",        label: "ICT / ยืมพัสดุ" },
  { key: "news",       label: "ข่าวสาร / ประชาสัมพันธ์" },
  { key: "other",      label: "อื่นๆ" },
];
const SEVERITIES = ["info", "warning", "critical"] as const;
const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ", director: "ผู้อำนวยการ", teacher: "ครู",
  student: "นักเรียน", parent: "ผู้ปกครอง", alumni: "ศิษย์เก่า",
};

type Row = {
  id?: string;
  role: string;
  category: string;
  in_app: boolean;
  push: boolean;
  line: boolean;
  gchat: boolean;
  min_severity: string;
};

export default function NotificationMatrixPage() {
  const qc = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [dirty, setDirty] = useState<Record<string, Row>>({});

  const { data, isPending } = useQuery({
    queryKey: ["role-notification-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_notification_defaults")
        .select("*");
      if (error) throw error;
      return data as Row[];
    },
    staleTime: 60_000,
  });

  useEffect(() => { setDirty({}); }, [selectedRole]);

  const rowFor = (category: string): Row => {
    const key = `${selectedRole}:${category}`;
    if (dirty[key]) return dirty[key];
    const found = (data ?? []).find(r => r.role === selectedRole && r.category === category);
    return found ?? { role: selectedRole, category, in_app: true, push: false, line: false, gchat: false, min_severity: "info" };
  };

  const patch = (category: string, changes: Partial<Row>) => {
    const key = `${selectedRole}:${category}`;
    setDirty(prev => ({ ...prev, [key]: { ...rowFor(category), ...changes } }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const rows = Object.values(dirty);
      if (rows.length === 0) return;
      const { error } = await supabase
        .from("role_notification_defaults")
        .upsert(rows.map(r => ({
          role: r.role, category: r.category,
          in_app: r.in_app, push: r.push, line: r.line, gchat: r.gchat,
          min_severity: r.min_severity,
        })), { onConflict: "role,category" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกเรียบร้อยแล้ว");
      setDirty({});
      qc.invalidateQueries({ queryKey: ["role-notification-matrix"] });
    },
    onError: (e: any) => toast.error("บันทึกไม่สำเร็จ", { description: e?.message }),
  });

  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="container mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>ตั้งค่าการแจ้งเตือนตามบทบาท (Role Notification Matrix)</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            กำหนดว่าแต่ละบทบาทควรได้รับแจ้งเตือนหมวดใด ผ่านช่องทางใด — ผู้ใช้ยังสามารถปิดของตนเองได้ในหน้า "การแจ้งเตือน"
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium">บทบาท:</span>
            {ROLES.map(r => (
              <Button
                key={r}
                variant={selectedRole === r ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRole(r)}
              >
                {ROLE_LABELS[r]}
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {dirtyCount > 0 && (
                <span className="text-sm text-warning">มีการเปลี่ยนแปลง {dirtyCount} รายการ</span>
              )}
              <Button
                onClick={() => save.mutate()}
                disabled={dirtyCount === 0 || save.isPending}
              >
                {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                บันทึก
              </Button>
            </div>
          </div>

          {isPending ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>หมวดหมู่</TableHead>
                    <TableHead className="text-center">ในแอป</TableHead>
                    <TableHead className="text-center">Push (PWA)</TableHead>
                    <TableHead className="text-center">LINE</TableHead>
                    <TableHead className="text-center">Google Chat</TableHead>
                    <TableHead>ระดับขั้นต่ำ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CATEGORIES.map(cat => {
                    const r = rowFor(cat.key);
                    return (
                      <TableRow key={cat.key}>
                        <TableCell className="font-medium">{cat.label}</TableCell>
                        <TableCell className="text-center">
                          <Switch checked={r.in_app} onCheckedChange={v => patch(cat.key, { in_app: v })} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={r.push} onCheckedChange={v => patch(cat.key, { push: v })} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={r.line} onCheckedChange={v => patch(cat.key, { line: v })} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={r.gchat} onCheckedChange={v => patch(cat.key, { gchat: v })} />
                        </TableCell>
                        <TableCell>
                          <Select value={r.min_severity} onValueChange={v => patch(cat.key, { min_severity: v })}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {SEVERITIES.map(s => (
                                <SelectItem key={s} value={s}>
                                  {s === "info" ? "ปกติ" : s === "warning" ? "เตือน" : "วิกฤต"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
