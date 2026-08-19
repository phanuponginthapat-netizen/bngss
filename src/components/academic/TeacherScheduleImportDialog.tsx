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
import { Loader2, Upload, CheckCircle2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { BE_OFFSET } from "@/lib/dateBE";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RowItem {
  key: number;
  personnelId: string; // "" = auto-detect ครูจากไฟล์
  file: File | null;
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

let rowCounter = 1;

export const TeacherScheduleImportDialog = ({ open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const { currentAcademicYear, currentSemester } = useAcademicYear();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [academicYear, setAcademicYear] = useState(String(currentAcademicYear ?? (new Date().getFullYear() + BE_OFFSET)));
  const [semester, setSemester] = useState(String(currentSemester ?? 1));
  const [replaceExisting, setReplaceExisting] = useState("1");
  const [rows, setRows] = useState<RowItem[]>([{ key: 0, personnelId: "", file: null }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setRows([{ key: rowCounter++, personnelId: "", file: null }]);
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

  const updateRow = (key: number, patch: Partial<RowItem>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { key: rowCounter++, personnelId: "", file: null }]);

  const removeRow = (key: number) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));

  const handleUpload = async () => {
    const validRows = rows.filter((r) => r.file);
    if (validRows.length === 0) { toast.error("กรุณาเลือกไฟล์ตารางสอนอย่างน้อย 1 ไฟล์"); return; }
    if (rows.some((r) => r.file && !r.personnelId)) {
      // auto mode อนุญาต แต่ถ้าผู้ใช้ต้องการระบุครูให้ครบ
    }
    setLoading(true);
    setResult(null);
    try {
      const yrCE = parseInt(academicYear) - BE_OFFSET;
      const items = [];
      for (const r of validRows) {
        const { base64, mime } = await fileToBase64(r.file!);
        items.push({
          personnel_id: r.personnelId || undefined,
          file_base64: base64,
          mime_type: mime,
        });
      }
      const { data, error } = await supabase.functions.invoke("import-teacher-schedule", {
        body: {
          items,
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
          <DialogTitle>อัปโหลดตารางสอน</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            อัปโหลดตารางสอนได้หลายไฟล์พร้อมกัน — ระบุครูต่อไฟล์ หรือปล่อยให้ระบบตรวจจับครูจากเอกสารเอง
            (เหมาะกับไฟล์ตารางทั้งโรงเรียน/หลายห้องในไฟล์เดียว)
          </p>

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

          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.key} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">ไฟล์ที่ {rows.indexOf(r) + 1}</Label>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-muted-foreground" onClick={() => removeRow(r.key)} disabled={rows.length === 1}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div>
                  <Label>เลือกครู <span className="text-muted-foreground">(เว้นว่าง = ตรวจจับอัตโนมัติจากไฟล์)</span></Label>
                  <Select value={r.personnelId} onValueChange={(v) => updateRow(r.key, { personnelId: v })}>
                    <SelectTrigger><SelectValue placeholder="-- ตรวจจับอัตโนมัติ --" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.prefix || ""}{t.first_name} {t.last_name !== "-" ? t.last_name : ""} ({t.employee_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>ไฟล์ตารางสอน (PDF, JPG, PNG)</Label>
                  <Input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => updateRow(r.key, { file: e.target.files?.[0] || null })}
                  />
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" className="w-full" onClick={addRow}>
              <Plus className="w-4 h-4 mr-2" />เพิ่มไฟล์/ครูอีก
            </Button>
          </div>

          <Button onClick={handleUpload} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {loading ? "กำลังประมวลผล..." : "อัปโหลดและประมวลผลทั้งหมด"}
          </Button>

          {result && (
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="font-medium">ผลลัพธ์รวม</span>
                <Badge variant="secondary">เพิ่ม {result.inserted}</Badge>
                <Badge variant="outline">ข้าม {result.skipped}</Badge>
                <Badge variant="outline">ไฟล์ {result.total}</Badge>
              </div>
              {(result.results || []).length > 0 && (
                <div className="space-y-1">
                  {result.results.map((res: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{res.teacher}</span>
                      {res.error ? (
                        <span className="text-destructive text-xs">{res.error}</span>
                      ) : (
                        <>
                          <Badge variant="secondary">เพิ่ม {res.inserted}</Badge>
                          <Badge variant="outline">ข้าม {res.skipped}</Badge>
                          {res.auto_detected && <Badge variant="outline" className="text-blue-600">ตรวจจับอัตโนมัติ</Badge>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {(result.warnings?.length > 0 || (result.results || []).some((r: any) => (r.warnings || []).length)) && (
                <details className="text-xs">
                  <summary className="cursor-pointer flex items-center gap-1 text-amber-700">
                    <AlertTriangle className="w-3 h-3" /> คำเตือน
                  </summary>
                  <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {result.warnings?.map((w: string, i: number) => (
                      <li key={`w${i}`} className="text-muted-foreground">• {w}</li>
                    ))}
                    {result.results?.map((res: any, i: number) =>
                      (res.warnings || []).map((w: string, j: number) => (
                        <li key={`r${i}${j}`} className="text-muted-foreground">• [{res.teacher}] {w}</li>
                      ))
                    )}
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