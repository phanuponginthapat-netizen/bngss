import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { createHeaderMatcher, detectHeaderRow, SCORE_ALIASES } from "@/lib/headerAlias";

const SCORE_MATCHER = createHeaderMatcher(SCORE_ALIASES);


interface PP6Info {
  schoolName: string;
  affiliation: string;
  directorName: string;
  directorTitle: string;
  academicHead: string;
  teacherName: string;
  teacherRole: string;
  semester: string;
  academicYear: number;
  gradeLevel: string;
  subjects: { name: string; code: string; type: string; credits: number; hours: number }[];
  characteristics: string[];
}

interface PP6StudentResult {
  seq: number;
  studentCode: string;
  studentName: string;
  subjectGrades: Record<string, number>;
}

interface ParsedPP6File {
  file: File;
  info: PP6Info;
  students: PP6StudentResult[];
  status: "pending" | "importing" | "success" | "error";
  error?: string;
}

interface PP6ImportDialogProps {
  onImportSuccess?: () => void;
}

const parseOnePP6File = (file: File): Promise<{ info: PP6Info; students: PP6StudentResult[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });

        const baseSheetName = wb.SheetNames.find(s => s.trim().startsWith("ข้อมูลพื้นฐาน"));
        if (!baseSheetName) { reject(new Error("ไม่พบชีท ข้อมูลพื้นฐาน")); return; }
        const baseSheet = wb.Sheets[baseSheetName];
        const cell = (sheet: any, r: number, c: number) => {
          const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
          return sheet[addr]?.v ?? null;
        };

        const schoolName = String(cell(baseSheet, 3, 4) || "").trim();
        const affiliation = String(cell(baseSheet, 4, 4) || "").trim();
        const directorName = String(cell(baseSheet, 5, 5) || "").trim();
        const directorTitle = String(cell(baseSheet, 6, 5) || "ผู้อำนวยการ").trim();
        const academicHead = String(cell(baseSheet, 7, 5) || "").trim();
        const teacherName = String(cell(baseSheet, 8, 5) || "").trim();
        const teacherRole = String(cell(baseSheet, 8, 4) || "ครูประจำชั้น").trim();
        const semesterStr = String(cell(baseSheet, 9, 4) || "").trim();
        const academicYear = parseInt(cell(baseSheet, 9, 6)) || new Date().getFullYear() + 543;
        const gradeLevelRaw = String(cell(baseSheet, 10, 5) || "").trim();

        let gradeLevel = gradeLevelRaw;
        if (gradeLevelRaw.includes("มัธยมศึกษาปีที่")) {
          const num = gradeLevelRaw.match(/(\d+)/)?.[1];
          if (num) gradeLevel = `ม.${num}`;
        } else if (gradeLevelRaw.includes("ประถมศึกษาปีที่")) {
          const num = gradeLevelRaw.match(/(\d+)/)?.[1];
          if (num) gradeLevel = `ป.${num}`;
        }

        const subjects: PP6Info["subjects"] = [];
        for (let r = 13; r <= 30; r++) {
          const subType = String(cell(baseSheet, r, 2) || "").trim();
          const subName = String(cell(baseSheet, r, 3) || "").trim();
          const subCode = String(cell(baseSheet, r, 4) || "").trim();
          if (!subName && !subCode) continue;
          subjects.push({
            name: subName, code: subCode, type: subType || "พื้นฐาน",
            credits: parseFloat(cell(baseSheet, r, 6)) || 0,
            hours: parseFloat(cell(baseSheet, r, 7)) || 0,
          });
        }

        const characteristics: string[] = [];
        for (let r = 13; r <= 22; r++) {
          const charName = String(cell(baseSheet, r, 9) || "").trim();
          if (charName) characteristics.push(charName);
        }

        const studentSheetName = wb.SheetNames.find(s => s.trim().startsWith("ข้อมูลนักเรียน"));
        if (!studentSheetName) { reject(new Error("ไม่พบชีท ข้อมูลนักเรียน")); return; }
        const studentSheet = wb.Sheets[studentSheetName];

        const results: PP6StudentResult[] = [];
        const range = XLSX.utils.decode_range(studentSheet["!ref"] || "A1");

        // ตรวจหัวตาราง — รองรับคอลัมน์เลื่อนจาก template
        const studentRows = XLSX.utils.sheet_to_json(studentSheet, { header: 1 }) as any[][];
        const detected = detectHeaderRow(studentRows, SCORE_MATCHER, { scanRows: 10, minHits: 2 });
        const ftc = detected?.fieldToCol ?? {};
        const dataStart = detected ? detected.rowIndex + 1 : 5;
        const cSeq = ftc.seq ?? 1;
        const cCode = ftc.student_code ?? 2;
        const cName = ftc.student_name ?? 3;
        // คอลัมน์วิชาเริ่มต่อจาก name (รักษาพฤติกรรมเดิม)
        const subjectStart = Math.max(cName + 1, 4);

        for (let r = dataStart; r <= range.e.r + 1; r++) {
          const seq = parseInt(cell(studentSheet, r, cSeq)) || 0;
          const code = String(cell(studentSheet, r, cCode) || "").trim();
          const name = String(cell(studentSheet, r, cName) || "").trim();
          if (!code && !name) continue;

          const subjectGrades: Record<string, number> = {};
          for (let c = subjectStart; c <= Math.min(range.e.c + 1, subjectStart + 15); c++) {
            const val = cell(studentSheet, r, c);
            if (val !== null && val !== undefined) {
              const subIdx = c - subjectStart;
              if (subIdx < subjects.length) {
                subjectGrades[subjects[subIdx].name] = parseFloat(val) || 0;
              }
            }
          }

          results.push({
            seq: seq || results.length + 1,
            studentCode: code, studentName: name, subjectGrades,
          });
        }


        resolve({
          info: {
            schoolName, affiliation, directorName, directorTitle,
            academicHead, teacherName, teacherRole, semester: semesterStr,
            academicYear, gradeLevel, subjects, characteristics,
          },
          students: results,
        });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.readAsBinaryString(file);
  });
};

const PP6ImportDialog = ({ onImportSuccess }: PP6ImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [parsedFiles, setParsedFiles] = useState<ParsedPP6File[]>([]);
  const [importing, setImporting] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newParsed: ParsedPP6File[] = [];
    let successCount = 0;

    for (const file of Array.from(files)) {
      try {
        const { info, students } = await parseOnePP6File(file);
        newParsed.push({ file, info, students, status: "pending" });
        successCount++;
      } catch (err: any) {
        newParsed.push({
          file,
          info: { schoolName: file.name, affiliation: "", directorName: "", directorTitle: "", academicHead: "", teacherName: "", teacherRole: "", semester: "", academicYear: 0, gradeLevel: "", subjects: [], characteristics: [] },
          students: [],
          status: "error",
          error: err.message,
        });
      }
    }

    setParsedFiles((prev) => [...prev, ...newParsed]);
    if (successCount > 0) toast.success(`อ่านไฟล์สำเร็จ ${successCount}/${files.length} ไฟล์`);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setParsedFiles((prev) => prev.filter((_, i) => i !== index));
    if (expandedIndex === index) setExpandedIndex(null);
  };

  const importSingleFile = async (pf: ParsedPP6File): Promise<boolean> => {
    const { info, file } = pf;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let teacherName = info.teacherName;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle();
        if (profile?.first_name) teacherName = `${profile.first_name} ${profile.last_name || ""}`.trim();
      }

      const ext = file.name.split('.').pop() || 'xlsx';
      const descriptiveName = `PP6_${info.gradeLevel}_T${info.semester}_${info.academicYear}_${teacherName}`;
      const safePath = descriptiveName.replace(/[^\x20-\x7E]/g, '_').replace(/\s+/g, '_');
      const filePath = `${info.academicYear}/${safePath}_${Date.now()}.${ext}`;
      const displayFileName = `${descriptiveName}.${ext}`;

      const { error: uploadErr } = await supabase.storage.from("pp6-files").upload(filePath, file);
      if (uploadErr) throw new Error("อัพโหลดไฟล์ล้มเหลว: " + uploadErr.message);

      // Match personnel by teacher name
      const cleanName = (info.teacherName || "").replace(/^(นาย|นาง|นางสาว|น\.ส\.|ดร\.)\s*/, "").trim();
      const parts = cleanName.split(/\s+/).filter(Boolean);
      let personnelId: string | null = null;
      if (parts.length >= 1) {
        const q = supabase.from("personnel").select("id").eq("first_name", parts[0]);
        const { data: pn } = parts[1]
          ? await q.eq("last_name", parts.slice(1).join(" ")).maybeSingle()
          : await q.maybeSingle();
        personnelId = pn?.id || null;
      }

      // Match classroom by grade_level (first match)
      const { data: cls } = await supabase.from("classrooms").select("id")
        .eq("grade_level", info.gradeLevel).limit(1).maybeSingle();

      // เก็บ filePath เป็น file_url ด้วย (private bucket — ใช้ resolveStorageUrl ตอนแสดง)
      const { error: insertErr } = await supabase.from("pp6_files").insert({
        file_name: displayFileName, file_url: filePath, file_path: filePath,
        grade_level: info.gradeLevel, classroom_name: info.gradeLevel,
        semester: parseInt(info.semester) || 1, academic_year: info.academicYear,
        teacher_name: teacherName, uploaded_by: user?.id,
        personnel_id: personnelId, classroom_id: cls?.id || null,
      } as any);
      if (insertErr) throw new Error("บันทึกข้อมูลไฟล์ล้มเหลว: " + insertErr.message);

      return true;
    } catch (err: any) {
      pf.error = err.message;
      return false;
    }
  };

  const handleImportAll = async () => {
    const pending = parsedFiles.filter((f) => f.status === "pending");
    if (pending.length === 0) { toast.error("ไม่มีไฟล์ที่พร้อมนำเข้า"); return; }

    setImporting(true);
    let successCount = 0;

    for (let i = 0; i < parsedFiles.length; i++) {
      const pf = parsedFiles[i];
      if (pf.status !== "pending") continue;

      setParsedFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "importing" } : f));
      const ok = await importSingleFile(pf);
      setParsedFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: ok ? "success" : "error" } : f));
      if (ok) successCount++;
    }

    qc.invalidateQueries({ queryKey: ["pp6_files"] });

    if (successCount > 0) {
      toast.success(`นำเข้าสำเร็จ ${successCount}/${pending.length} ไฟล์`);
      onImportSuccess?.();
    }
    if (successCount === pending.length) {
      setTimeout(() => { setOpen(false); reset(); }, 1000);
    }
    setImporting(false);
  };

  const reset = () => {
    setParsedFiles([]);
    setExpandedIndex(null);
  };

  const pendingCount = parsedFiles.filter((f) => f.status === "pending").length;
  const successCount = parsedFiles.filter((f) => f.status === "success").length;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          นำเข้า ปพ.6
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            นำเข้าข้อมูลจากไฟล์ ปพ.6
          </DialogTitle>
        </DialogHeader>

        {/* Upload section - always visible */}
        <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
          <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium">เลือกไฟล์ ปพ.6 (.xlsx) — รองรับหลายไฟล์พร้อมกัน</p>
            <p className="text-sm text-muted-foreground">ระบบจะอ่านข้อมูลพื้นฐาน รายวิชา และนักเรียนอัตโนมัติ</p>
          </div>
          <div>
            <Label htmlFor="pp6-file" className="sr-only">เลือกไฟล์</Label>
            <Input
              id="pp6-file"
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={handleFiles}
              className="max-w-xs mx-auto cursor-pointer"
            />
          </div>
        </div>

        {/* Parsed files list */}
        {parsedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                ไฟล์ทั้งหมด {parsedFiles.length} ไฟล์
                {pendingCount > 0 && <span className="text-muted-foreground"> • พร้อมนำเข้า {pendingCount} ไฟล์</span>}
                {successCount > 0 && <span className="text-success"> • สำเร็จ {successCount} ไฟล์</span>}
              </p>
              <Button variant="ghost" size="sm" onClick={reset} className="text-xs">ล้างทั้งหมด</Button>
            </div>

            <div className="space-y-2">
              {parsedFiles.map((pf, idx) => (
                <Card key={idx} className={`transition-colors ${pf.status === "success" ? "border-success/30 bg-success/50" : pf.status === "error" ? "border-danger/30 bg-danger/50" : pf.status === "importing" ? "border-info/30 bg-info/50" : ""}`}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            ปพ.6 {pf.info.gradeLevel || pf.file.name}
                          </p>
                          {pf.info.gradeLevel && (
                            <Badge variant="outline" className="text-xs shrink-0">{pf.info.gradeLevel}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {pf.info.semester && <span>เทอม {pf.info.semester}</span>}
                          {pf.info.academicYear > 0 && <span>ปี {pf.info.academicYear}</span>}
                          {pf.students.length > 0 && <span>{pf.students.length} คน</span>}
                          {pf.info.subjects.length > 0 && <span>{pf.info.subjects.length} วิชา</span>}
                          {pf.info.teacherName && <span>ครู: {pf.info.teacherName}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {pf.status === "success" && <Badge className="bg-success-soft text-success text-xs gap-1"><CheckCircle2 className="w-3 h-3" />สำเร็จ</Badge>}
                        {pf.status === "error" && (
                          <Badge className="bg-danger-soft text-danger text-xs gap-1" title={pf.error}>
                            <AlertCircle className="w-3 h-3" />ผิดพลาด
                          </Badge>
                        )}
                        {pf.status === "importing" && <Badge className="bg-info-soft text-info text-xs">กำลังนำเข้า...</Badge>}
                        {pf.students.length > 0 && pf.status === "pending" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedIndex(expandedIndex === idx ? null : idx)}>
                            {expandedIndex === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        )}
                        {pf.status !== "importing" && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeFile(idx)}>
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expandedIndex === idx && (
                      <div className="mt-3 space-y-2">
                        {pf.info.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {pf.info.subjects.map((s, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{s.name} ({s.code})</Badge>
                            ))}
                          </div>
                        )}
                        <div className="rounded-lg border overflow-x-auto max-h-[250px] overflow-y-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12 text-center">ลำดับ</TableHead>
                                <TableHead className="w-24">รหัส</TableHead>
                                <TableHead>ชื่อ-สกุล</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pf.students.map((s, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-center text-xs">{s.seq}</TableCell>
                                  <TableCell className="font-mono text-xs">{s.studentCode}</TableCell>
                                  <TableCell className="text-sm">{s.studentName}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {pf.status === "error" && pf.error && (
                      <p className="text-xs text-danger mt-2">{pf.error}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {pendingCount > 0 && (
              <div className="flex justify-end pt-2">
                <Button onClick={handleImportAll} disabled={importing} className="gap-2">
                  <Upload className="w-4 h-4" />
                  {importing ? "กำลังนำเข้า..." : `นำเข้าทั้งหมด ${pendingCount} ไฟล์`}
                </Button>
              </div>
            )}
          </div>
        )}

        {parsedFiles.length === 0 && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">รองรับไฟล์ ปพ.6 (รศ.1) มาตรฐาน สพฐ.</p>
              <p>• สามารถเลือกหลายไฟล์พร้อมกันได้</p>
              <p>• ระบบจะดึงข้อมูลจากชีท ข้อมูลพื้นฐาน และ ข้อมูลนักเรียน</p>
              <p>• ข้อมูลโรงเรียน ครูประจำชั้น รายวิชา จะถูกอ่านอัตโนมัติ</p>
              <p>• ไฟล์จะถูกจัดเก็บและตั้งชื่อตามระดับชั้น ภาคเรียน ปีการศึกษา</p>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PP6ImportDialog;
