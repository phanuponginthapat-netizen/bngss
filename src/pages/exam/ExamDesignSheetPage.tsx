import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Printer, Settings2 } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { BE_OFFSET } from "@/lib/dateBE";

const DIGITS = ["0","1","2","3","4","5","6","7","8","9"];
const CHOICE_FORMATS: Record<string, string[]> = {
  abcd: ["A", "B", "C", "D"],
  "1234": ["1", "2", "3", "4"],
  thai: ["ก", "ข", "ค", "ง"],
};

export default function ExamDesignSheetPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { schoolName, schoolLogo, appName } = useSystemSettings();

  const { data: exam } = useQuery({
    queryKey: ["exam", id],
    enabled: !!id,
    queryFn: async () => (await supabase
      .from("exams")
      .select("*, subjects(name_th), classrooms(name)")
      .eq("id", id).maybeSingle()).data,
  });
  const { data: sheet } = useQuery({
    queryKey: ["exam-sheet", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("exam_sheets").select("*").eq("exam_id", id).maybeSingle()).data,
  });
  const { data: teacher } = useQuery({
    queryKey: ["exam-teacher", exam?.teacher_id],
    enabled: !!exam?.teacher_id,
    queryFn: async () => {
      const { data: p } = await supabase.from("personnel")
        .select("prefix, first_name, last_name").eq("user_id", exam!.teacher_id).maybeSingle();
      if (p) return `${p.prefix || ""}${p.first_name || ""} ${p.last_name || ""}`.trim();
      const { data: rows } = await (supabase.rpc as any)("get_profiles_public", { _ids: [exam!.teacher_id] });
      const pr = (rows as any[])?.[0];
      return pr ? `${pr.first_name || ""} ${pr.last_name || ""}`.trim() || "-" : "-";
    },
  });

  if (!exam) return <p className="p-6">กำลังโหลด...</p>;

  const layout = (sheet?.layout_config as any) || {};
  const choiceFormat = (["abcd", "1234", "thai"] as const).includes(layout.choice_format)
    ? layout.choice_format as "abcd" | "1234" | "thai"
    : "abcd";
  const LETTERS = CHOICE_FORMATS[choiceFormat];
  const digits = layout.student_code_digits ?? sheet?.student_code_digits ?? 5;
  const showLogo = layout.show_logo !== false;
  const showHeader = layout.show_header !== false;
  const academicYear = exam.academic_year
    ? `${exam.academic_year + BE_OFFSET}`
    : `${new Date().getFullYear() + BE_OFFSET}`;

  // States
  const [fmt, setFmt] = useState<"abcd" | "1234" | "thai">(choiceFormat);
  const [logo, setLogo] = useState(layout.show_logo !== false);
  const [header, setHeader] = useState(layout.show_header !== false);
  const [codeDigits, setCodeDigits] = useState(digits);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  async function save() {
    if (!id) return toast.error("ยังไม่มีข้อมูลข้อสอบ");
    setSaving(true);
    try {
      const { error } = await supabase.from("exam_sheets").upsert({
        exam_id: id,
        layout_config: { ...layout, choice_format: fmt, show_logo: logo, show_header: header },
        student_code_digits: Math.max(1, Math.min(10, Number(codeDigits) || 5)),
      }, { onConflict: "exam_id" });
      if (error) throw error;
      toast.success("บันทึกรูปแบบกระดาษคำตอบแล้ว");
      navigate(`/exam/${id}/answer-sheet`);
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">ออกแบบกระดาษคำตอบ</h1>

      <Card className="p-6 space-y-4">
        <div>
          <Label>รูปแบบตัวเลือก</Label>
          <RadioGroup
            value={fmt}
            onValueChange={(v) => setFmt(v as any)}
            className="flex gap-4 mt-2"
          >
            {[
              { v: "abcd", l: "A B C D" },
              { v: "1234", l: "1 2 3 4" },
              { v: "thai", l: "ก ข ค ง" },
            ].map((o) => (
              <label key={o.v} className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value={o.v} />
                <span>{o.l}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
        <div>
          <Label>จำนวนหลักรหัสนักเรียน</Label>
          <Input type="number" min={1} max={10} value={codeDigits}
            onChange={(e) => setCodeDigits(Number(e.target.value))} />
        </div>
        <div className="flex items-center justify-between">
          <Label>แสดงโลโก้โรงเรียน</Label>
          <Switch checked={logo} onCheckedChange={setLogo} />
        </div>
        <div className="flex items-center justify-between">
          <Label>แสดงหัวกระดาษ (ชื่อโรงเรียน/วิชา)</Label>
          <Switch checked={header} onCheckedChange={setHeader} />
        </div>
        <p className="text-xs text-muted-foreground">
          การตั้งค่าจะบันทึกลงในข้อสอบ จึงสามารถพิมพ์กระดาษคำตอบได้ทันที
        </p>
        <Button onClick={save} disabled={saving} className="w-full">
          {saving ? "กำลังบันทึก..." : "บันทึกและพิมพ์"}
        </Button>
      </Card>
    </div>
  );
}