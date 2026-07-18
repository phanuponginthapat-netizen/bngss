import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Check, FileText, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedSubject {
  code: string;
  name_th: string;
  name_en: string;
  credits: number;
  hours_per_week: number;
  grade_level: string;
  subject_type: string;
  semester: number; // 0 = ทั้งปี (ประถม), 1 = เทอม1, 2 = เทอม2
}

const SUBJECT_TYPE_MAP: Record<string, string> = {
  "พื้นฐาน": "required",
  "เพิ่มเติม": "elective",
  "กิจกรรม": "activity",
  "กิจกรรมพัฒนาผู้เรียน": "activity",
  "required": "required",
  "elective": "elective",
  "activity": "activity",
};

const isElementary = (grade: string) => /^ป\.\d/.test(grade);

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const CurriculumUploadDialog = ({ open, onOpenChange }: Props) => {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedSubject[]>([]);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [deleteMissing, setDeleteMissing] = useState(true);
  const [diff, setDiff] = useState<{ toAdd: number; toUpdate: number; toDelete: number; deleteRows: any[] } | null>(null);

  const handleExcelFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (rows.length === 0) {
      toast.error("ไม่พบข้อมูลในไฟล์");
      return;
    }

    const subjects: ParsedSubject[] = rows.map((row) => {
      const code = String(row["รหัสวิชา"] || row["code"] || row["รหัส"] || "").trim();
      const name_th = String(row["ชื่อวิชา"] || row["name_th"] || row["ชื่อ"] || row["วิชา"] || "").trim();
      const name_en = String(row["ชื่อวิชา(อังกฤษ)"] || row["name_en"] || row["English"] || "").trim();
      const credits = parseFloat(row["หน่วยกิต"] || row["credits"] || "1") || 1;
      const hours = parseInt(row["ชั่วโมง/สัปดาห์"] || row["hours_per_week"] || row["ชม./สัปดาห์"] || row["ชั่วโมง"] || "1") || 1;
      const grade = String(row["ระดับชั้น"] || row["grade_level"] || row["ชั้น"] || "").trim();
      const typeRaw = String(row["ประเภท"] || row["subject_type"] || row["type"] || "required").trim();
      const semRaw = parseInt(row["ภาคเรียน"] || row["semester"] || "0");
      // Auto-detect: if elementary and no semester specified, default to 0 (yearly)
      const semester = isElementary(grade) && semRaw === 0 ? 0 : (semRaw || 1);

      return {
        code,
        name_th,
        name_en,
        credits,
        hours_per_week: hours,
        grade_level: grade,
        subject_type: SUBJECT_TYPE_MAP[typeRaw] || "required",
        semester,
      };
    }).filter((s) => s.code && s.name_th);

    setParsed(subjects);
    await computeDiff(subjects);
    toast.success(`พบ ${subjects.length} รายวิชา`);
  };

  const handlePdfFile = async (file: File) => {
    setParsing(true);
    try {
      toast.info("กำลังอ่านไฟล์ PDF และวิเคราะห์ด้วย AI...");
      const pdfBase64 = await fileToBase64(file);

      const { data, error } = await supabase.functions.invoke("parse-curriculum-pdf", {
        body: { pdfBase64 },
      });

      if (error) throw error;
      if (!data?.subjects || !Array.isArray(data.subjects)) {
        throw new Error("AI ไม่สามารถวิเคราะห์ข้อมูลได้");
      }

      const subjects: ParsedSubject[] = data.subjects.map((s: any) => {
        const semester = parseInt(s.semester) || 0;
        const hoursRaw = parseInt(s.hours_per_year) || 40;
        // For elementary (semester=0), hours_per_week = yearly hours / 40 weeks
        // For secondary (semester=1|2), hours_per_week = semester hours / 20 weeks
        const weeksPerPeriod = semester === 0 ? 40 : 20;
        const hoursPerWeek = Math.max(1, Math.round(hoursRaw / weeksPerPeriod));
        const credits = s.credits ? parseFloat(s.credits) : Math.max(0.5, Math.round((hoursRaw / 40) * 2) / 2);

        return {
          code: String(s.code || "").trim(),
          name_th: String(s.name_th || "").trim(),
          name_en: "",
          credits,
          hours_per_week: hoursPerWeek,
          grade_level: String(s.grade_level || "").trim(),
          subject_type: s.subject_type || "required",
          semester,
        };
      }).filter((s: ParsedSubject) => s.code && s.name_th);

      setParsed(subjects);
      await computeDiff(subjects);

      const yearly = subjects.filter(s => s.semester === 0).length;
      const sem1 = subjects.filter(s => s.semester === 1).length;
      const sem2 = subjects.filter(s => s.semester === 2).length;
      toast.success(`AI วิเคราะห์พบ ${subjects.length} รายวิชา (ทั้งปี: ${yearly}, เทอม1: ${sem1}, เทอม2: ${sem2})`);
    } catch (err: any) {
      toast.error("ไม่สามารถวิเคราะห์ PDF ได้: " + err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") {
        await handlePdfFile(file);
      } else {
        await handleExcelFile(file);
      }
    } catch (err: any) {
      toast.error("ไม่สามารถอ่านไฟล์ได้: " + err.message);
    }

    if (fileRef.current) fileRef.current.value = "";
  };

  const computeDiff = async (subjects: ParsedSubject[]) => {
    const currentYear = new Date().getFullYear();
    const { data: existing, error } = await supabase
      .from("subjects")
      .select("id, code, semester")
      .eq("academic_year", currentYear);
    if (error) {
      setDiff(null);
      return;
    }
    const key = (c: string, s: number) => `${c}__${s}`;
    const existingMap = new Map((existing || []).map((r: any) => [key(r.code, r.semester ?? 0), r]));
    const newKeys = new Set(subjects.map((s) => key(s.code, s.semester)));
    let toAdd = 0, toUpdate = 0;
    for (const s of subjects) {
      if (existingMap.has(key(s.code, s.semester))) toUpdate++;
      else toAdd++;
    }
    const deleteRows = (existing || []).filter((r: any) => !newKeys.has(key(r.code, r.semester ?? 0)));
    setDiff({ toAdd, toUpdate, toDelete: deleteRows.length, deleteRows });
  };

  const handleSave = async () => {
    if (parsed.length === 0) return;
    const __tid_save_1 = toast.loading("กำลังบันทึก...");
    setSaving(true);
    try {
      const currentYear = new Date().getFullYear();
      const dedup = new Map<string, any>();
      for (const s of parsed) {
        dedup.set(`${s.code}__${s.semester}`, {
          code: s.code,
          name_th: s.name_th,
          name_en: s.name_en || null,
          credits: s.credits,
          hours_per_week: s.hours_per_week,
          grade_level: s.grade_level || null,
          subject_type: s.subject_type,
          semester: s.semester,
          academic_year: currentYear,
        });
      }
      const inserts = Array.from(dedup.values());

      const { error } = await supabase.from("subjects").upsert(inserts, {
        onConflict: "code,semester",
        ignoreDuplicates: false,
      });

      if (error) throw error;

      let deletedCount = 0;
      if (deleteMissing && diff && diff.deleteRows.length > 0) {
        const ids = diff.deleteRows.map((r: any) => r.id);
        const { error: delErr } = await supabase.from("subjects").delete().in("id", ids);
        if (delErr) {
          toast.warning(`ลบรายวิชาเดิมไม่สำเร็จ: ${delErr.message} (อาจมีตารางสอน/คะแนนอ้างอิงอยู่)`);
        } else {
          deletedCount = ids.length;
        }
      }

      const added = diff?.toAdd ?? 0;
      const updated = diff?.toUpdate ?? parsed.length;
      toast.success(`ซิงค์หลักสูตรสำเร็จ — เพิ่ม ${added}, อัปเดต ${updated}, ลบ ${deletedCount}`);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["teacher_assignments"] });
      setParsed([]);
      setDiff(null);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      toast.dismiss(__tid_save_1);
      setSaving(false);
    }
  };

  const typeLabel = (t: string) => {
    switch (t) {
      case "required": return "พื้นฐาน";
      case "elective": return "เพิ่มเติม";
      case "activity": return "กิจกรรม";
      default: return t;
    }
  };

  const typeBadgeVariant = (t: string) => {
    switch (t) {
      case "activity": return "default" as const;
      case "elective": return "secondary" as const;
      default: return "outline" as const;
    }
  };

  const semLabel = (s: number) => {
    if (s === 0) return "ทั้งปี";
    return `เทอม ${s}`;
  };

  // Group subjects by semester for display
  const yearly = parsed.filter(s => s.semester === 0);
  const sem1 = parsed.filter(s => s.semester === 1);
  const sem2 = parsed.filter(s => s.semester === 2);

  const groups = [
    { key: "yearly", label: "รายวิชาทั้งปี (ประถมศึกษา)", badge: "default" as const, subjects: yearly },
    { key: "sem1", label: "ภาคเรียนที่ 1 (มัธยมศึกษา)", badge: "default" as const, subjects: sem1 },
    { key: "sem2", label: "ภาคเรียนที่ 2 (มัธยมศึกษา)", badge: "secondary" as const, subjects: sem2 },
  ].filter(g => g.subjects.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            อัปโหลดหลักสูตรสถานศึกษา
          </DialogTitle>
          <DialogDescription>
            อัปโหลดไฟล์หลักสูตร (PDF, Excel, CSV) — ประถมจะลงวิชาทั้งปี, มัธยมจะแยกภาคเรียนตามรหัสวิชา
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="hidden"
              onChange={handleFile}
              disabled={parsing}
            />
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-1">
              รองรับไฟล์ PDF, Excel (.xlsx, .xls) และ CSV
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                PDF — AI วิเคราะห์แยกประถม (ทั้งปี) / มัธยม (แยกเทอม)
              </span>
              <span className="flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3" />
                Excel/CSV — คอลัมน์: รหัสวิชา, ชื่อวิชา, หน่วยกิต, ชั่วโมง, ระดับชั้น, ประเภท, ภาคเรียน
              </span>
            </div>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing}>
              {parsing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  กำลังวิเคราะห์ PDF...
                </>
              ) : (
                "เลือกไฟล์"
              )}
            </Button>
          </div>

          {parsed.length > 0 && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{parsed.length} รายวิชา</Badge>
                  {yearly.length > 0 && (
                    <span className="text-xs text-muted-foreground">ทั้งปี: {yearly.length}</span>
                  )}
                  {sem1.length > 0 && (
                    <span className="text-xs text-muted-foreground">เทอม 1: {sem1.length}</span>
                  )}
                  {sem2.length > 0 && (
                    <span className="text-xs text-muted-foreground">เทอม 2: {sem2.length}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    (พื้นฐาน: {parsed.filter(s => s.subject_type === "required").length},
                    เพิ่มเติม: {parsed.filter(s => s.subject_type === "elective").length},
                    กิจกรรม: {parsed.filter(s => s.subject_type === "activity").length})
                  </span>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                  <Check className="w-4 h-4 mr-1" />
                  {saving ? "กำลังซิงค์..." : "ซิงค์หลักสูตร"}
                </Button>
              </div>

              {diff && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <Badge variant="default">เพิ่มใหม่ {diff.toAdd}</Badge>
                    <Badge variant="secondary">อัปเดต {diff.toUpdate}</Badge>
                    <Badge variant={diff.toDelete > 0 ? "destructive" : "outline"}>
                      ไม่อยู่ในหลักสูตรใหม่ {diff.toDelete}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="delete-missing"
                      checked={deleteMissing}
                      onCheckedChange={(v) => setDeleteMissing(!!v)}
                    />
                    <Label htmlFor="delete-missing" className="text-xs cursor-pointer">
                      ลบรายวิชาเดิมที่ไม่อยู่ในหลักสูตรใหม่ ({diff.toDelete} รายการ)
                    </Label>
                  </div>
                  {diff.toDelete > 0 && deleteMissing && (
                    <p className="text-[11px] text-muted-foreground">
                      หมายเหตุ: หากรายวิชาเดิมถูกใช้ในตารางสอน/คะแนน อาจลบไม่ได้
                    </p>
                  )}
                </div>
              )}

              {groups.map(group => (
                <div key={group.key}>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Badge variant={group.badge}>{group.label}</Badge>
                    <span className="text-xs text-muted-foreground font-normal">{group.subjects.length} รายวิชา</span>
                  </h3>
                  <div className="max-h-[250px] overflow-auto border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[100px]">รหัส</TableHead>
                          <TableHead>ชื่อวิชา</TableHead>
                          <TableHead className="text-center w-[70px]">นก.</TableHead>
                          <TableHead className="text-center w-[70px]">ชม./สป.</TableHead>
                          <TableHead className="w-[80px]">ระดับชั้น</TableHead>
                          <TableHead className="w-[80px]">ประเภท</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.subjects.map((s, i) => (
                          <TableRow key={`${group.key}-${i}`}>
                            <TableCell className="font-mono text-xs">{s.code}</TableCell>
                            <TableCell className="text-sm">{s.name_th}</TableCell>
                            <TableCell className="text-center">{s.credits}</TableCell>
                            <TableCell className="text-center">{s.hours_per_week}</TableCell>
                            <TableCell>{s.grade_level || "-"}</TableCell>
                            <TableCell>
                              <Badge variant={typeBadgeVariant(s.subject_type)} className="text-[10px]">
                                {typeLabel(s.subject_type)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
