import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";

const CHOICE_FORMATS: Record<string, string[]> = {
  abcd: ["A", "B", "C", "D"],
  "1234": ["1", "2", "3", "4"],
  thai: ["ก", "ข", "ค", "ง"],
};

export default function ExamDesignSheetPage() {
  const { id: rawId } = useParams();
  const navigate = useNavigate();
  // ลิงก์จากเมนูอาจเป็น ":id" (placeholder) → ถือว่ายังไม่ได้เลือกข้อสอบ
  const id = rawId && rawId !== ":id" && rawId !== "id" ? rawId : undefined;

  const { data: exam, isLoading: examLoading } = useQuery({
    queryKey: ["exam", id],
    enabled: !!id,
    queryFn: async () => (await supabase
      .from("exams")
      .select("*, subjects(name_th), classrooms(name)")
      .eq("id", id!).maybeSingle()).data,
  });

  const { data: sheet, isLoading: sheetLoading } = useQuery({
    queryKey: ["exam-sheet", id],
    enabled: !!id,
    queryFn: async () => (await supabase.from("exam_sheets").select("*").eq("exam_id", id!).maybeSingle()).data,
  });

  const { data: examList, isLoading: listLoading } = useQuery({
    queryKey: ["exams-for-design-sheet"],
    enabled: !id,
    queryFn: async () => (await supabase
      .from("exams")
      .select("id, title, academic_year, subjects(name_th), classrooms(name)")
      .order("created_at", { ascending: false })
      .limit(100)).data || [],
  });

  const [fmt, setFmt] = useState<"abcd" | "1234" | "thai">("abcd");
  const [logo, setLogo] = useState(true);
  const [header, setHeader] = useState(true);
  const [codeDigits, setCodeDigits] = useState(5);
  const [saving, setSaving] = useState(false);

  const layout = (sheet?.layout_config as any) || {};

  useEffect(() => {
    if (!sheet) return;
    const l = (sheet.layout_config as any) || {};
    if (Object.keys(CHOICE_FORMATS).includes(l.choice_format)) setFmt(l.choice_format);
    setLogo(l.show_logo !== false);
    setHeader(l.show_header !== false);
    setCodeDigits(l.student_code_digits ?? sheet.student_code_digits ?? 5);
  }, [sheet]);

  async function save() {
    if (!id) return toast.error("ยังไม่ได้เลือกข้อสอบ");
    setSaving(true);
    try {
      const { error } = await supabase.from("exam_sheets").upsert({
        exam_id: id,
        layout_config: { ...layout, choice_format: fmt, show_logo: logo, show_header: header },
        student_code_digits: Math.max(1, Math.min(10, Number(codeDigits) || 5)),
      }, { onConflict: "exam_id" });
      if (error) throw error;
      toast.success("บันทึกรูปแบบกระดาษคำตอบแล้ว");
      navigate(`/dashboard/exam/${id}/answer-sheet`);
    } catch (e: any) {
      toast.error(e?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  // ยังไม่ได้เลือกข้อสอบ → แสดงรายการให้เลือก
  if (!id) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">ออกแบบกระดาษคำตอบ</h1>
        <p className="text-muted-foreground mb-4">เลือกข้อสอบที่ต้องการออกแบบกระดาษคำตอบ</p>
        <Card className="p-2">
          {listLoading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลดรายการข้อสอบ...
            </div>
          ) : !examList?.length ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-muted-foreground">ยังไม่มีข้อสอบในระบบ</p>
              <Button onClick={() => navigate("/dashboard/exam")}>ไปหน้าจัดการข้อสอบ</Button>
            </div>
          ) : (
            <ul className="divide-y">
              {examList.map((e: any) => (
                <li key={e.id}>
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-accent/50 rounded-md flex items-center gap-3"
                    onClick={() => navigate(`/dashboard/exam/${e.id}/design-sheet`)}
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block font-medium truncate">{e.title || "ไม่มีชื่อ"}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {[e.subjects?.name_th, e.classrooms?.name].filter(Boolean).join(" · ") || "-"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  if (examLoading || sheetLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-3">
        <p className="text-muted-foreground">ไม่พบข้อสอบนี้ หรือไม่มีสิทธิ์เข้าถึง</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/exam")}>กลับหน้าข้อสอบ</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-1">ออกแบบกระดาษคำตอบ</h1>
      <p className="text-muted-foreground mb-6 truncate">
        {[(exam as any).title, (exam as any).subjects?.name_th, (exam as any).classrooms?.name].filter(Boolean).join(" · ")}
      </p>

      <Card className="p-6 space-y-4">
        <div>
          <Label>รูปแบบตัวเลือก</Label>
          <RadioGroup value={fmt} onValueChange={(v) => setFmt(v as any)} className="flex gap-4 mt-2">
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
