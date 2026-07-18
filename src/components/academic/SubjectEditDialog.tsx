import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface SubjectEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: any | null;
}

export const SubjectEditDialog = ({ open, onOpenChange, subject }: SubjectEditDialogProps) => {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    code: "", name_th: "", name_en: "", credits: "1.0", hours_per_week: "1",
    grade_level: "", semester: "1", subject_type: "required"
  });

  useEffect(() => {
    if (subject) {
      setForm({
        code: subject.code || "",
        name_th: subject.name_th || "",
        name_en: subject.name_en || "",
        credits: String(subject.credits || 1),
        hours_per_week: String(subject.hours_per_week || 1),
        grade_level: subject.grade_level || "",
        semester: String(subject.semester || 1),
        subject_type: subject.subject_type || "required",
      });
    }
  }, [subject]);

  const handleSave = async () => {
    if (!form.code || !form.name_th) {
      toast.error("กรุณากรอกรหัสวิชาและชื่อวิชา"); return;
    }
    const { error } = await supabase.from("subjects").update({
      code: form.code,
      name_th: form.name_th,
      name_en: form.name_en || null,
      credits: parseFloat(form.credits),
      hours_per_week: parseInt(form.hours_per_week) || 1,
      grade_level: form.grade_level || null,
      semester: parseInt(form.semester),
      subject_type: form.subject_type,
    }).eq("id", subject?.id);
    if (error) { toast.error(error.message); return; }
    toast.success("แก้ไขรายวิชาสำเร็จ");
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["subjects"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>แก้ไขรายวิชา</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>รหัสวิชา</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></div>
            <div><Label>หน่วยกิต</Label><Input type="number" step="0.5" value={form.credits} onChange={e => setForm({...form, credits: e.target.value})} /></div>
          </div>
          <div><Label>ชื่อวิชา (ไทย)</Label><Input value={form.name_th} onChange={e => setForm({...form, name_th: e.target.value})} /></div>
          <div><Label>ชื่อวิชา (อังกฤษ)</Label><Input value={form.name_en} onChange={e => setForm({...form, name_en: e.target.value})} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>ชั่วโมง/สัปดาห์</Label><Input type="number" min="1" value={form.hours_per_week} onChange={e => setForm({...form, hours_per_week: e.target.value})} /></div>
            <div><Label>ระดับชั้น</Label><Input placeholder="ม.1" value={form.grade_level} onChange={e => setForm({...form, grade_level: e.target.value})} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>ภาคเรียน</Label>
              <Select value={form.semester} onValueChange={v => setForm({...form, semester: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>ประเภทวิชา</Label>
              <Select value={form.subject_type} onValueChange={v => setForm({...form, subject_type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">วิชาพื้นฐาน</SelectItem>
                  <SelectItem value="elective">วิชาเพิ่มเติม</SelectItem>
                  <SelectItem value="activity">กิจกรรมพัฒนาผู้เรียน</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSave} className="w-full">บันทึกการแก้ไข</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
