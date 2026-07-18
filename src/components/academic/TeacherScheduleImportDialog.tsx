import { useEffect, useState } from "react";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { BE_OFFSET } from "@/lib/dateBE";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const base64 = r.split(",")[1];
      resolve({ base64, mime: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const TeacherScheduleImportDialog = ({ open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const { currentAcademicYear, currentSemester } = useAcademicYear();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [personnelId, setPersonnelId] = useState("");
  // currentAcademicYear จาก useAcademicYear() เป็น พ.ศ. อยู่แล้ว — fallback ใช้ปีปัจจุบัน + BE_OFFSET
  const [academicYear, setAcademicYear] = useState(String(currentAcademicYear ?? (new Date().getFullYear() + BE_OFFSET)));

  const [semester, setSemester] = useState(String(currentSemester ?? 1));
  const [replaceExisting, setReplaceExisting] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setFile(null);
    if (currentAcademicYear) setAcademicYear(String(currentAcademicYear));
    if (currentSemester) setSemester(String(currentSemester));
    (async () => {
      const { data } = await supabase
        .from("personnel")
        .select("id, prefix, first_name, last_name, employee_code")
        .eq("status", "active")
        .order("first_name");
      setTeachers(data || []);
    })();
  }, [open]);

  const handleUpload = async () => {
    if (!personnelId) { toast.error("กรุณาเลือกครู"); return; }
    if (!file) { toast.error("กรุณาเลือกไฟล์ตารางสอน"); return; }
    setLoading(true);
    setResult(null);
    try {
      const { base64, mime } = await fileToBase64(file);
      const yrCE = parseInt(academicYear) - BE_OFFSET;
      const { data, error } = await supabase.functions.invoke("import-teacher-schedule", {
        body: {
          personnel_id: personnelId,
          file_base64: base64,
          mime_type: mime,
          academic_year: yrCE,
          semester: parseInt(semester),
          replace_existing: replaceExisting === "1",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast.success(`นำเข้าสำเร็จ ${data.inserted} คาบ (ข้าม ${data.skipped})`);
      qc.invalidateQueries({ queryKey: ["schedules"] });
    } catch (e: any) {
      toast.error(e.message || "นำเข้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl sm:max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>อัปโหลดตารางสอนครูรายบุคคล</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ใช้ไฟล์ตารางสอนของครูแต่ละคน (PDF/รูป) ที่มีชื่อวิชา + ห้องเรียนชัดเจน เพื่อ map ตารางสอนให้ตรงกับวิชาในหลักสูตร
          </p>

          <div>
            <Label>เลือกครู</Label>
            <Select value={personnelId} onValueChange={setPersonnelId}>
              <SelectTrigger><SelectValue placeholder="-- เลือกครู --" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.prefix || ""}{t.first_name} {t.last_name !== "-" ? t.last_name : ""} ({t.employee_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>ปีการศึกษา (พ.ศ.)</Label>
              <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
            </div>
            <div>
              <Label>ภาคเรียน</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ตารางเดิม</Label>
              <Select value={replaceExisting} onValueChange={setReplaceExisting}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">แทนที่ของเดิม</SelectItem>
                  <SelectItem value="0">เพิ่มเข้าไป</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>ไฟล์ตารางสอน (PDF, JPG, PNG)</Label>
            <Input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>

          <Button onClick={handleUpload} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {loading ? "กำลังประมวลผล..." : "อัปโหลดและประมวลผล"}
          </Button>

          {result && (
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="font-medium">{result.teacher}</span>
                <Badge variant="secondary">เพิ่ม {result.inserted}</Badge>
                <Badge variant="outline">ข้าม {result.skipped}</Badge>
                <Badge variant="outline">รวม {result.total}</Badge>
              </div>
              {result.warnings?.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer flex items-center gap-1 text-amber-700">
                    <AlertTriangle className="w-3 h-3" /> คำเตือน ({result.warnings.length})
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {result.warnings.map((w: string, i: number) => (
                      <li key={i} className="text-muted-foreground">• {w}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
