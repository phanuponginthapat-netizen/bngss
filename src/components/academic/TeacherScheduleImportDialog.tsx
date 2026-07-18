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
  const [academicYear, setAcademicYear] = useState(String(currentAcademicYear ?? new Date().getFullYear() + 543));
  const [semester, setSemester] = useState(String(currentSemester ?? 1));
  const [replaceExisting, setReplaceExisting] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [progress, setProgress] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setFile(null);
    setFiles([]);
    setProgress("");
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
    if (bulkMode) {
      if (files.length === 0) { toast.error("กรุณาเลือกไฟล์ตารางสอน"); return; }
    } else {
      if (!personnelId) { toast.error("กรุณาเลือกครู"); return; }
      if (!file) { toast.error("กรุณาเลือกไฟล์ตารางสอน"); return; }
    }
    setLoading(true);
    setResult(null);
    try {
      const yrCE = parseInt(academicYear) - 543;
      if (bulkMode) {
        const aggregate: any = { inserted: 0, updated: 0, skipped: 0, total: 0, warnings: [], per_teacher: [] };
        let i = 0;
        for (const f of files) {
          i++;
          setProgress(`กำลังประมวลผลไฟล์ ${i}/${files.length}: ${f.name}`);
          const { base64, mime } = await fileToBase64(f);
          const { data, error } = await supabase.functions.invoke("import-teacher-schedule", {
            body: {
              bulk: true,
              file_base64: base64, mime_type: mime,
              academic_year: yrCE, semester: parseInt(semester),
              replace_existing: replaceExisting === "1",
            },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          aggregate.inserted += data.inserted || 0;
          aggregate.updated += data.updated || 0;
          aggregate.skipped += data.skipped || 0;
          aggregate.total += data.total || 0;
          aggregate.warnings.push(...(data.warnings || []));
          aggregate.per_teacher.push(...(data.per_teacher || []));
        }
        aggregate.teacher = `${aggregate.per_teacher.length} ครู จาก ${files.length} ไฟล์`;
        setResult(aggregate);
        toast.success(`นำเข้าสำเร็จ ${aggregate.inserted} คาบ (ปรับปรุง ${aggregate.updated}, ข้าม ${aggregate.skipped})`);
      } else {
        const { base64, mime } = await fileToBase64(file!);
        const { data, error } = await supabase.functions.invoke("import-teacher-schedule", {
          body: {
            personnel_id: personnelId,
            file_base64: base64, mime_type: mime,
            academic_year: yrCE, semester: parseInt(semester),
            replace_existing: replaceExisting === "1",
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setResult(data);
        toast.success(`นำเข้าสำเร็จ ${data.inserted} คาบ (ข้าม ${data.skipped})`);
      }
      qc.invalidateQueries({ queryKey: ["schedules"] });
    } catch (e: any) {
      toast.error(e.message || "นำเข้าไม่สำเร็จ");
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>นำเข้าตารางสอน (PDF)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 p-1 rounded-lg bg-muted">
            <button type="button" onClick={() => setBulkMode(false)} className={`flex-1 px-3 py-1.5 rounded text-sm ${!bulkMode ? "bg-background shadow font-medium" : "text-muted-foreground"}`}>รายครู (1 ไฟล์/ครู)</button>
            <button type="button" onClick={() => setBulkMode(true)} className={`flex-1 px-3 py-1.5 rounded text-sm ${bulkMode ? "bg-background shadow font-medium" : "text-muted-foreground"}`}>หลายครู (1 ครู/หน้า)</button>
          </div>

          <p className="text-sm text-muted-foreground">
            {bulkMode
              ? "อัปโหลดไฟล์ PDF ที่รวมตารางสอนหลายครู (1 ครู ต่อ 1 หน้า) ระบบจะอ่านชื่อครูบนหัวตารางและจับคู่กับบุคลากรอัตโนมัติ พร้อมดึงเลขห้องในวงเล็บ"
              : "ใช้ไฟล์ตารางสอนของครูแต่ละคน (PDF/รูป) เพื่อ map กับวิชาในหลักสูตร"}
          </p>

          {!bulkMode && (
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
          )}

          <div className="grid grid-cols-3 gap-3">
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
            <Label>{bulkMode ? "ไฟล์ PDF (เลือกได้หลายไฟล์)" : "ไฟล์ตารางสอน (PDF, JPG, PNG)"}</Label>
            <Input
              type="file"
              accept={bulkMode ? ".pdf" : ".pdf,image/*"}
              multiple={bulkMode}
              onChange={(e) => {
                const list = Array.from(e.target.files || []);
                if (bulkMode) setFiles(list);
                else setFile(list[0] || null);
              }}
            />
            {bulkMode && files.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{files.length} ไฟล์: {files.map(f => f.name).join(", ")}</p>
            )}
          </div>

          <Button onClick={handleUpload} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {loading ? (progress || "กำลังประมวลผล...") : "อัปโหลดและประมวลผล"}
          </Button>

          {result && (
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span className="font-medium">{result.teacher}</span>
                <Badge variant="secondary">เพิ่ม {result.inserted}</Badge>
                {result.updated ? <Badge variant="secondary">ปรับปรุง {result.updated}</Badge> : null}
                <Badge variant="outline">ข้าม {result.skipped}</Badge>
                <Badge variant="outline">รวม {result.total}</Badge>
              </div>
              {result.per_teacher?.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer">สรุปรายครู ({result.per_teacher.length})</summary>
                  <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {result.per_teacher.map((p: any, i: number) => (
                      <li key={i}>• {p.teacher}: +{p.inserted} / ~{p.updated} (จาก {p.total_rows})</li>
                    ))}
                  </ul>
                </details>
              )}
              {result.warnings?.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer flex items-center gap-1 text-warning">
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
