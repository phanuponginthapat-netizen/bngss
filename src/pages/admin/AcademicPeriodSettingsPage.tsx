import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit, Trash2, CheckCircle2, Lock, Calendar } from "lucide-react";
import { confirmDelete } from "@/lib/confirmAction";
import { DateInput } from "@/components/ui/date-input";

interface PeriodRow {
  id: string;
  academic_year_be: number;
  semester: 1 | 2;
  start_date: string;
  end_date: string;
  midterm_date: string | null;
  final_date: string | null;
  is_current: boolean;
  is_closed: boolean;
  note: string | null;
}

export default function AcademicPeriodSettingsPage() {
  const { lang } = useLanguage();
  const { isAdmin, isDirector } = useUserRole();
  const canEdit = isAdmin || isDirector;
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<PeriodRow> | null>(null);

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["academic_periods_admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("academic_periods" as any)
        .select("*")
        .order("academic_year_be", { ascending: false })
        .order("semester", { ascending: true });
      return (data || []) as unknown as PeriodRow[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["academic_periods_admin"] });
    qc.invalidateQueries({ queryKey: ["academic_periods_all"] });
  };

  const handleSave = async () => {
    if (!edit) return;
    if (!edit.academic_year_be || !edit.semester || !edit.start_date || !edit.end_date) {
      toast.error(lang === "th" ? "กรอกข้อมูลให้ครบ" : "Fill all required fields");
      return;
    }
    if (edit.start_date >= edit.end_date) {
      toast.error(lang === "th" ? "วันเปิดเทอมต้องน้อยกว่าวันปิดเทอม" : "Start must be before end");
      return;
    }
    const payload: any = {
      academic_year_be: edit.academic_year_be,
      semester: edit.semester,
      start_date: edit.start_date,
      end_date: edit.end_date,
      midterm_date: edit.midterm_date || null,
      final_date: edit.final_date || null,
      is_current: !!edit.is_current,
      is_closed: !!edit.is_closed,
      note: edit.note || null,
    };
    const { error } = edit.id
      ? await supabase.from("academic_periods" as any).update(payload).eq("id", edit.id)
      : await supabase.from("academic_periods" as any).insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(lang === "th" ? "บันทึกแล้ว" : "Saved");
    setEdit(null);
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDelete(lang === "th" ? "ลบช่วงนี้?" : "Delete this period?"))) return;
    const { error } = await supabase.from("academic_periods" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(lang === "th" ? "ลบแล้ว" : "Deleted");
    refresh();
  };

  const handleSetCurrent = async (id: string) => {
    const { error } = await supabase
      .from("academic_periods" as any)
      .update({ is_current: true })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(lang === "th" ? "ตั้งเป็นเทอมปัจจุบันแล้ว" : "Marked as current");
    refresh();
  };

  const toggleClosed = async (row: PeriodRow) => {
    const { error } = await supabase
      .from("academic_periods" as any)
      .update({ is_closed: !row.is_closed })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {lang === "th" ? "ตั้งค่าปีการศึกษา / เทอม" : "Academic Periods"}
            </CardTitle>
            {canEdit && (
              <Button
                size="sm"
                onClick={() =>
                  setEdit({
                    academic_year_be: new Date().getFullYear() + 543,
                    semester: 1,
                    start_date: "",
                    end_date: "",
                  })
                }
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {lang === "th" ? "เพิ่มเทอม" : "Add Period"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {lang === "th"
              ? "ระบุช่วงวันที่จริงของแต่ละปี/เทอม เพื่อให้ทั้งระบบ (วิชาการ/บุคลากร/นักเรียน) คำนวณภาคเรียนได้ตรงกัน"
              : "Define the real start/end dates for each year & semester so the whole system can resolve terms consistently."}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
          ) : periods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {lang === "th" ? "ยังไม่มีข้อมูล" : "No periods yet"}
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{lang === "th" ? "ปี (พ.ศ.)" : "Year (BE)"}</TableHead>
                    <TableHead>{lang === "th" ? "เทอม" : "Sem"}</TableHead>
                    <TableHead>{lang === "th" ? "เปิด" : "Start"}</TableHead>
                    <TableHead>{lang === "th" ? "ปิด" : "End"}</TableHead>
                    <TableHead>{lang === "th" ? "กลางภาค" : "Midterm"}</TableHead>
                    <TableHead>{lang === "th" ? "ปลายภาค" : "Final"}</TableHead>
                    <TableHead>{lang === "th" ? "สถานะ" : "Status"}</TableHead>
                    {canEdit && <TableHead className="text-right">{lang === "th" ? "การจัดการ" : "Actions"}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold">{p.academic_year_be}</TableCell>
                      <TableCell>{p.semester}</TableCell>
                      <TableCell>{p.start_date}</TableCell>
                      <TableCell>{p.end_date}</TableCell>
                      <TableCell>{p.midterm_date || "-"}</TableCell>
                      <TableCell>{p.final_date || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.is_current && (
                            <Badge variant="default" className="text-[10px] h-5">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" />
                              {lang === "th" ? "ปัจจุบัน" : "Current"}
                            </Badge>
                          )}
                          {p.is_closed && (
                            <Badge variant="outline" className="text-[10px] h-5 border-danger/30 text-danger">
                              <Lock className="w-3 h-3 mr-0.5" />
                              {lang === "th" ? "ปิด" : "Closed"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!p.is_current && (
                              <Button size="sm" variant="ghost" onClick={() => handleSetCurrent(p.id)} title={lang === "th" ? "ตั้งเป็นปัจจุบัน" : "Set current"}>
                                <CheckCircle2 className="w-4 h-4 text-success" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => toggleClosed(p)} title={p.is_closed ? "Reopen" : "Close"}>
                              <Lock className={`w-4 h-4 ${p.is_closed ? "text-danger" : "text-muted-foreground"}`} />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEdit(p)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {edit?.id
                ? lang === "th" ? "แก้ไขเทอม" : "Edit period"
                : lang === "th" ? "เพิ่มเทอม" : "New period"}
            </DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{lang === "th" ? "ปี (พ.ศ.)" : "Year (BE)"} *</Label>
                  <Input
                    type="number"
                    value={edit.academic_year_be ?? ""}
                    onChange={(e) => setEdit({ ...edit, academic_year_be: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label className="text-xs">{lang === "th" ? "เทอม" : "Semester"} *</Label>
                  <Select
                    value={String(edit.semester ?? 1)}
                    onValueChange={(v) => setEdit({ ...edit, semester: parseInt(v) as 1 | 2 })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{lang === "th" ? "วันเปิด" : "Start"} *</Label>
                  <DateInput value={edit.start_date || ""} onChange={(e) => setEdit({ ...edit, start_date: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{lang === "th" ? "วันปิด" : "End"} *</Label>
                  <DateInput value={edit.end_date || ""} onChange={(e) => setEdit({ ...edit, end_date: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{lang === "th" ? "สอบกลางภาค" : "Midterm"}</Label>
                  <DateInput value={edit.midterm_date || ""} onChange={(e) => setEdit({ ...edit, midterm_date: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">{lang === "th" ? "สอบปลายภาค" : "Final"}</Label>
                  <DateInput value={edit.final_date || ""} onChange={(e) => setEdit({ ...edit, final_date: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">{lang === "th" ? "หมายเหตุ" : "Note"}</Label>
                <Input value={edit.note || ""} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <Label className="text-sm flex items-center gap-2">
                  <Switch checked={!!edit.is_current} onCheckedChange={(v) => setEdit({ ...edit, is_current: v })} />
                  {lang === "th" ? "ตั้งเป็นเทอมปัจจุบัน" : "Set as current"}
                </Label>
                <Label className="text-sm flex items-center gap-2">
                  <Switch checked={!!edit.is_closed} onCheckedChange={(v) => setEdit({ ...edit, is_closed: v })} />
                  {lang === "th" ? "ปิดเทอม (ล็อก)" : "Close (lock)"}
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>{lang === "th" ? "ยกเลิก" : "Cancel"}</Button>
            <Button onClick={handleSave}>{lang === "th" ? "บันทึก" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
