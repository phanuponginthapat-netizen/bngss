import { useState, useRef } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, ChevronDown, ChevronUp, Download, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { createHeaderMatcher, detectHeaderRow, SCORE_ALIASES } from "@/lib/headerAlias";

const SCORE_MATCHER = createHeaderMatcher(SCORE_ALIASES);


interface PP5SubjectInfo {
  subjectName: string;
  subjectCode: string;
  gradeLevel: string;
  semester: number;
  academicYear: number;
  teacherName: string;
  schoolName: string;
  totalHours: number;
}

interface PP5AssessmentItem {
  studentCode: string;
  studentName: string;
  totalScore: number;
  summaryScore: number;
  level: number; // 0-3
}

interface PP5AssessmentData {
  character: PP5AssessmentItem[]; // คุณลักษณะอันพึงประสงค์
  competency: PP5AssessmentItem[]; // สมรรถนะสำคัญ
  reading: PP5AssessmentItem[]; // อ่านคิดวิเคราะห์
}

interface PP5StudentResult {
  seq: number;
  studentCode: string;
  studentName: string;
  attendanceHours: number;
  attendancePercent: number;
  attendancePass: boolean;
  courseworkScore: number;
  examScore: number;
  totalScore: number;
  gradePoint: number;
  grade: string;
  readingAssessment: string;
  characterAssessment: string;
  competencyAssessment: string;
  finalResult: string;
}

interface ParsedFile {
  file: File;
  subjectInfo: PP5SubjectInfo;
  students: PP5StudentResult[];
  assessments: PP5AssessmentData;
  status: "pending" | "importing" | "success" | "error";
  error?: string;
}

const gradePointToGrade = (gp: number): string => {
  if (gp >= 4) return "4";
  if (gp >= 3.5) return "3.5";
  if (gp >= 3) return "3";
  if (gp >= 2.5) return "2.5";
  if (gp >= 2) return "2";
  if (gp >= 1.5) return "1.5";
  if (gp >= 1) return "1";
  return "0";
};

interface PP5ImportDialogProps {
  onImportSuccess?: () => void;
}

const levelFromText = (text: string): number => {
  if (text === "ดีเยี่ยม") return 3;
  if (text === "ดี") return 2;
  if (text === "ผ่าน" || text === "พอใช้") return 1;
  return 0;
};

const levelToText = (level: number): string => {
  if (level >= 3) return "ดีเยี่ยม";
  if (level >= 2) return "ดี";
  if (level >= 1) return "ผ่าน";
  return "ไม่ผ่าน";
};

const parseAssessmentSheet = (
  wb: XLSX.WorkBook,
  sheetName: string,
  startRow: number,
  scoreCol: number,
  summaryCol: number,
  levelCol: number,
  codeCol: number = 3,
  nameCol: number = 4,
): PP5AssessmentItem[] => {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const cell = (r: number, c: number) => {
    const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    return ws[addr]?.v ?? null;
  };
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  const items: PP5AssessmentItem[] = [];
  for (let r = startRow; r <= range.e.r + 1; r++) {
    const code = String(cell(r, codeCol) || "").trim();
    const name = String(cell(r, nameCol) || "").trim();
    if (!code || !name) continue;
    const totalScore = parseFloat(cell(r, scoreCol)) || 0;
    const summaryScore = parseFloat(cell(r, summaryCol)) || 0;
    const levelVal = cell(r, levelCol);
    const level = typeof levelVal === "number" ? levelVal : levelFromText(String(levelVal || ""));
    items.push({ studentCode: code, studentName: name, totalScore, summaryScore, level });
  }
  return items;
};

const parseOneFile = (file: File): Promise<{ subjectInfo: PP5SubjectInfo; students: PP5StudentResult[]; assessments: PP5AssessmentData }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });

        const home = wb.Sheets["Home"];
        if (!home) { reject(new Error("ไม่พบชีท Home")); return; }
        const hd = XLSX.utils.sheet_to_json(home, { header: 1 }) as any[][];

        const getCell = (r: number, c: number) => String(hd?.[r - 1]?.[c - 1] || "").trim();

        const info: PP5SubjectInfo = {
          schoolName: getCell(3, 3),
          gradeLevel: getCell(9, 3),
          subjectName: getCell(11, 3),
          subjectCode: getCell(12, 3),
          teacherName: getCell(15, 3),
          semester: parseInt(getCell(4, 6)) || 1,
          academicYear: parseInt(getCell(5, 6)) || new Date().getFullYear() + 543,
          totalHours: 0,
        };

        const gl = info.gradeLevel;
        if (gl.includes("มัธยมศึกษาปีที่")) {
          const num = gl.match(/(\d+)/)?.[1];
          if (num) info.gradeLevel = `ม.${num}`;
        } else if (gl.includes("ประถมศึกษาปีที่")) {
          const num = gl.match(/(\d+)/)?.[1];
          if (num) info.gradeLevel = `ป.${num}`;
        }

        const summary = wb.Sheets["สรุปตัดสินผลการเรียน"];
        if (!summary) { reject(new Error("ไม่พบชีท สรุปตัดสินผลการเรียน")); return; }

        const cell = (r: number, c: number) => {
          const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
          return summary[addr]?.v ?? null;
        };

        const hoursHeader = String(cell(6, 5) || "");
        const hoursMatch = hoursHeader.match(/(\d+)\s*ชั่วโมง/);
        if (hoursMatch) info.totalHours = parseInt(hoursMatch[1]);

        const results: PP5StudentResult[] = [];
        const range = XLSX.utils.decode_range(summary["!ref"] || "A1");

        // พยายามตรวจหัวตารางก่อน (รองรับ template ที่สลับ/แทรกคอลัมน์)
        const summaryRows = XLSX.utils.sheet_to_json(summary, { header: 1 }) as any[][];
        const detected = detectHeaderRow(summaryRows, SCORE_MATCHER, { scanRows: 12, minHits: 4 });
        const ftc = detected?.fieldToCol ?? {};
        const dataStartRow = detected ? detected.rowIndex + 1 : 8;
        const colCode = ftc.student_code ?? 3;
        const colName = ftc.student_name ?? 4;
        const colHours = ftc.attendance_hours ?? 5;
        const colPct = ftc.attendance_percent ?? 6;
        const colPass = ftc.attendance_pass ?? 7;
        const colCw = ftc.assignment_score ?? 11;
        const colExam = ftc.final_score ?? 12;
        const colTotal = ftc.total_score ?? 13;
        const colGrade = ftc.grade_point ?? ftc.grade ?? 14;
        const colReading = ftc.reading_assessment ?? 15;
        const colChar = ftc.character_assessment ?? 16;
        const colComp = ftc.competency_assessment ?? 17;
        const colResult = ftc.final_result ?? 18;
        const colSeq = ftc.seq ?? 2;

        for (let r = dataStartRow; r <= range.e.r + 1; r++) {
          const code = String(cell(r, colCode) || "").trim();
          const name = String(cell(r, colName) || "").trim();
          if (!code || !name) continue;

          const attendanceHours = parseFloat(cell(r, colHours)) || 0;
          const attendancePercent = parseFloat(cell(r, colPct)) || 0;
          const coursework = parseFloat(cell(r, colCw)) || 0;
          const exam = parseFloat(cell(r, colExam)) || 0;
          const total = parseFloat(cell(r, colTotal)) || 0;
          const gradeRaw = String(cell(r, colGrade) || "").trim();
          const gradePoint = parseFloat(gradeRaw) || 0;

          results.push({
            seq: parseInt(cell(r, colSeq)) || results.length + 1,
            studentCode: code,
            studentName: name,
            attendanceHours,
            attendancePercent: Math.round(attendancePercent * 100) / 100,
            attendancePass: String(cell(r, colPass) || "").includes("ผ่าน"),
            courseworkScore: coursework,
            examScore: exam,
            totalScore: total,
            gradePoint,
            grade: gradeRaw || gradePointToGrade(gradePoint),
            readingAssessment: String(cell(r, colReading) || ""),
            characterAssessment: String(cell(r, colChar) || ""),
            competencyAssessment: String(cell(r, colComp) || ""),
            finalResult: String(cell(r, colResult) || ""),
          });
        }


        // Parse assessment detail sheets
        // คุณลักษณะ: data starts row 6, code=C3, name=C4, totalScore=C28, summaryScore=C29, no level col (use summary)
        const character = parseAssessmentSheet(wb, "คุณลักษณะ", 6, 28, 29, 29, 3, 4);
        // Map level from summary sheet characterAssessment
        const charLevelMap = new Map(results.map(s => [s.studentCode, levelFromText(s.characterAssessment)]));
        character.forEach(c => { c.level = charLevelMap.get(c.studentCode) ?? c.level; });

        // สมรรถนะ: data starts row 6, totalScore=C22, summaryScore=C23, level=C24
        const competency = parseAssessmentSheet(wb, "สมรรถนะ", 6, 22, 23, 24, 3, 4);

        // คิดวิเคราะห์: data starts row 7, totalScore=C26, summaryScore=C27, level=C28
        const reading = parseAssessmentSheet(wb, "คิดวิเคราะห์", 7, 26, 27, 28, 3, 4);

        const assessments: PP5AssessmentData = { character, competency, reading };

        resolve({ subjectInfo: info, students: results, assessments });
      } catch (err: any) {
        reject(err);
      }
    };
    reader.readAsBinaryString(file);
  });
};

const PP5ImportDialog = ({ onImportSuccess }: PP5ImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [importing, setImporting] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newParsed: ParsedFile[] = [];
    let successCount = 0;

    for (const file of Array.from(files)) {
      try {
        const { subjectInfo, students, assessments } = await parseOneFile(file);
        newParsed.push({ file, subjectInfo, students, assessments, status: "pending" });
        successCount++;
      } catch (err: any) {
        newParsed.push({
          file,
          subjectInfo: { subjectName: file.name, subjectCode: "", gradeLevel: "", semester: 1, academicYear: 0, teacherName: "", schoolName: "", totalHours: 0 },
          students: [],
          assessments: { character: [], competency: [], reading: [] },
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

  const importSingleFile = async (pf: ParsedFile): Promise<boolean> => {
    const { subjectInfo, students, assessments, file } = pf;
    if (students.length === 0) return false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      let teacherName = subjectInfo.teacherName;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle();
        if (profile?.first_name) teacherName = `${profile.first_name} ${profile.last_name || ""}`.trim();
      }

      // ===== 3-tier subject matching: (name+grade+sem+year) → (code+sem) → create =====
      let subjectId: string | undefined;
      // tier 1: name + grade + semester + academic_year
      const { data: byName } = await supabase.from("subjects").select("id")
        .eq("name_th", subjectInfo.subjectName)
        .eq("grade_level", subjectInfo.gradeLevel)
        .eq("semester", subjectInfo.semester)
        .eq("academic_year", subjectInfo.academicYear)
        .maybeSingle();
      subjectId = byName?.id;
      // tier 2: code + semester
      if (!subjectId && subjectInfo.subjectCode) {
        const { data: byCode } = await supabase.from("subjects").select("id")
          .eq("code", subjectInfo.subjectCode).eq("semester", subjectInfo.semester)
          .maybeSingle();
        subjectId = byCode?.id;
        if (subjectId) {
          await supabase.from("subjects").update({
            academic_year: subjectInfo.academicYear, name_th: subjectInfo.subjectName,
            grade_level: subjectInfo.gradeLevel,
          }).eq("id", subjectId);
        }
      }
      // tier 3: upsert (กัน race / case ที่ name มีช่องว่างต่างกัน)
      if (!subjectId) {
        const payload: any = {
          code: subjectInfo.subjectCode || `AUTO-${Date.now().toString(36)}`,
          name_th: subjectInfo.subjectName,
          grade_level: subjectInfo.gradeLevel,
          semester: subjectInfo.semester,
          academic_year: subjectInfo.academicYear,
        };
        const { data: upserted, error: subErr } = await supabase.from("subjects")
          .upsert(payload, { onConflict: "school_id,name_th,grade_level,semester,academic_year", ignoreDuplicates: false })
          .select("id").maybeSingle();
        if (subErr || !upserted) {
          // fallback: ดึงตัวที่มีอยู่ขึ้นมาใช้แทน
          const { data: existing } = await supabase.from("subjects").select("id")
            .eq("name_th", subjectInfo.subjectName)
            .eq("grade_level", subjectInfo.gradeLevel)
            .eq("semester", subjectInfo.semester)
            .eq("academic_year", subjectInfo.academicYear)
            .limit(1).maybeSingle();
          if (!existing) throw new Error("สร้างรายวิชาล้มเหลว: " + (subErr?.message || "ไม่ทราบสาเหตุ"));
          subjectId = existing.id;
        } else {
          subjectId = upserted.id;
        }
      }


      // Find personnel by teacher_name (use prefix-normalized matching)
      const cleanName = subjectInfo.teacherName.replace(/^(นาย|นาง|นางสาว|น\.ส\.|ดร\.)\s*/, "").trim();
      const teacherParts = cleanName.split(/\s+/).filter(Boolean);
      let personnelId: string | null = null;
      if (teacherParts.length >= 1) {
        const firstName = teacherParts[0];
        const lastName = teacherParts.slice(1).join(" ") || null;
        const q = supabase.from("personnel").select("id").eq("first_name", firstName);
        const { data: personnel } = lastName
          ? await q.eq("last_name", lastName).maybeSingle()
          : await q.maybeSingle();
        personnelId = personnel?.id || null;
      }

      // Upload file
      const ext = file.name.split('.').pop() || 'xlsx';
      const descriptiveName = `PP5_${subjectInfo.gradeLevel}_${subjectInfo.subjectName}_T${subjectInfo.semester}_${subjectInfo.academicYear}_${teacherName}`;
      const safePath = descriptiveName.replace(/[^\x20-\x7E]/g, '_').replace(/\s+/g, '_');
      const filePath = `${subjectInfo.academicYear}/${safePath}_${Date.now()}.${ext}`;
      const displayFileName = `${descriptiveName}.${ext}`;

      const { error: uploadErr } = await supabase.storage.from("pp5-files").upload(filePath, file);
      if (uploadErr) throw new Error("อัพโหลดไฟล์ล้มเหลว: " + uploadErr.message);

      // Bucket private — sign on demand; store the path so readers can re-sign.
      const { data: urlData } = await supabase.storage.from("pp5-files").createSignedUrl(filePath, 60 * 60 * 24 * 365);
      const { error: insertErr } = await supabase.from("pp5_files").insert({
        file_name: displayFileName, file_url: urlData?.signedUrl || "", file_path: filePath,
        subject_name: subjectInfo.subjectName, subject_code: subjectInfo.subjectCode,
        grade_level: subjectInfo.gradeLevel, semester: subjectInfo.semester,
        academic_year: subjectInfo.academicYear, teacher_name: teacherName,
        subject_id: subjectId, personnel_id: personnelId,
      } as any);
      if (insertErr) throw new Error("บันทึกข้อมูลไฟล์ล้มเหลว: " + insertErr.message);

      // Insert scores
      const scoreInserts = students.map((s) => ({
        student_code: s.studentCode, student_name: s.studentName, subject_id: subjectId!,
        assignment_score: s.courseworkScore, final_score: s.examScore,
        grade: s.grade, grade_point: s.gradePoint,
        semester: subjectInfo.semester, academic_year: subjectInfo.academicYear,
      }));
      const { error: scoreErr } = await supabase.from("student_scores").upsert(scoreInserts as any, { onConflict: "student_code,subject_id" });
      if (scoreErr) throw new Error("บันทึกคะแนนล้มเหลว: " + scoreErr.message);

      // Attendance
      const { data: existingStudents } = await supabase.from("students").select("id, student_code")
        .in("student_code", students.map((s) => s.studentCode));
      const studentMap = new Map((existingStudents || []).map((s: any) => [s.student_code, s.id]));
      const attendanceInserts = students.filter((s) => studentMap.has(s.studentCode)).map((s) => ({
        student_id: studentMap.get(s.studentCode)!, subject_id: subjectId!,
        attendance_date: todayBangkok(),
        status: s.attendancePass ? "present" : "absent",
        semester: subjectInfo.semester, academic_year: subjectInfo.academicYear,
        notes: `ปพ.5: มาเรียน ${s.attendanceHours}/${subjectInfo.totalHours} ชม. (${s.attendancePercent}%)`,
        recorded_by: `นำเข้าจาก ปพ.5 - ${subjectInfo.teacherName}`,
      }));
      if (attendanceInserts.length > 0) await supabase.from("attendance").insert(attendanceInserts as any);

      // ── Import Assessment Data ──
      // personnelId already resolved above

      // Find or create classroom
      let classroomId: string | null = null;
      const { data: classroom } = await supabase.from("classrooms").select("id")
        .eq("grade_level", subjectInfo.gradeLevel)
        .eq("academic_year", subjectInfo.academicYear).limit(1).maybeSingle();
      classroomId = classroom?.id || null;

      // Create teacher_assignment if personnel and subject exist
      if (personnelId && subjectId) {
        const { data: existingAssignment } = await supabase.from("teacher_assignments").select("id")
          .eq("personnel_id", personnelId).eq("subject_id", subjectId)
          .eq("semester", subjectInfo.semester).eq("academic_year", subjectInfo.academicYear)
          .maybeSingle();
        if (!existingAssignment) {
          await supabase.from("teacher_assignments").insert({
            personnel_id: personnelId, subject_id: subjectId,
            classroom_id: classroomId,
            semester: subjectInfo.semester, academic_year: subjectInfo.academicYear,
          } as any);
        }
      }

      // Create default assessment criteria if none exist
      const assessmentCategories = [
        { category: "character", items: ["รักชาติ ศาสน์ กษัตริย์", "ซื่อสัตย์สุจริต", "มีวินัย", "ใฝ่เรียนรู้", "อยู่อย่างพอเพียง", "มุ่งมั่นในการทำงาน", "รักความเป็นไทย", "มีจิตสาธารณะ"] },
        { category: "competency", items: ["ความสามารถในการสื่อสาร", "ความสามารถในการคิด", "ความสามารถในการแก้ปัญหา", "ความสามารถในการใช้ทักษะชีวิต", "ความสามารถในการใช้เทคโนโลยี"] },
        { category: "reading", items: ["การอ่าน คิดวิเคราะห์ และเขียน"] },
      ];

      for (const cat of assessmentCategories) {
        const { data: existingCriteria } = await supabase.from("assessment_criteria").select("id, title")
          .eq("category", cat.category).eq("is_active", true);
        
        if (!existingCriteria || existingCriteria.length === 0) {
          const inserts = cat.items.map((title, idx) => ({
            title, category: cat.category, sort_order: idx, is_active: true,
          }));
          await supabase.from("assessment_criteria").insert(inserts as any);
        }
      }

      // Now insert assessment scores for students who exist in the system
      if (studentMap.size > 0) {
        const { data: allCriteria } = await supabase.from("assessment_criteria").select("id, title, category").eq("is_active", true);
        if (allCriteria && allCriteria.length > 0) {
          const criteriaMap = new Map(allCriteria.map((c: any) => [`${c.category}:${c.title}`, c.id]));
          
          const assessmentScoreInserts: any[] = [];

          // Helper to create assessment scores from parsed data
          const processAssessmentCategory = (
            items: PP5AssessmentItem[],
            category: string,
            criteriaTitle: string | null, // null = use overall summary
          ) => {
            const criteriaForCategory = allCriteria.filter((c: any) => c.category === category);
            if (criteriaForCategory.length === 0) return;

            for (const item of items) {
              const studentId = studentMap.get(item.studentCode);
              if (!studentId) continue;

              if (criteriaTitle) {
                // Single criteria
                const criteriaId = criteriaMap.get(`${category}:${criteriaTitle}`);
                if (criteriaId) {
                  assessmentScoreInserts.push({
                    student_id: studentId, criteria_id: criteriaId,
                    score: item.summaryScore, level: levelToText(item.level),
                    semester: subjectInfo.semester, academic_year: subjectInfo.academicYear,
                  });
                }
              } else {
                // Apply summary score to ALL criteria in this category
                for (const criteria of criteriaForCategory) {
                  assessmentScoreInserts.push({
                    student_id: studentId, criteria_id: criteria.id,
                    score: item.summaryScore, level: levelToText(item.level),
                    semester: subjectInfo.semester, academic_year: subjectInfo.academicYear,
                  });
                }
              }
            }
          };

          // Character: apply overall score to all character criteria
          processAssessmentCategory(assessments.character, "character", null);
          // Competency: apply overall score to all competency criteria
          processAssessmentCategory(assessments.competency, "competency", null);
          // Reading: single criteria
          processAssessmentCategory(assessments.reading, "reading", "การอ่าน คิดวิเคราะห์ และเขียน");

          if (assessmentScoreInserts.length > 0) {
            await supabase.from("student_assessment_scores").upsert(
              assessmentScoreInserts,
              { onConflict: "student_id,criteria_id,semester,academic_year" } as any
            );
          }
        }
      }

      return true;
    } catch (err: any) {
      pf.error = err.message;
      return false;
    }
  };

  // Validation summary calculated from parsed files
  const validationSummary = (() => {
    const pending = parsedFiles.filter((f) => f.status === "pending" && f.students.length > 0);
    let totalStudentsAll = 0;
    let outOfRange = 0;
    let duplicateCodes = 0;
    let missingGrade = 0;
    let attendanceFail = 0;
    let lowScore = 0; // grade=0
    const seenCodes = new Set<string>();
    pending.forEach((pf) => {
      pf.students.forEach((s) => {
        totalStudentsAll++;
        if (s.totalScore < 0 || s.totalScore > 100) outOfRange++;
        if (!s.grade || s.grade === "-") missingGrade++;
        if (s.grade === "0") lowScore++;
        if (!s.attendancePass) attendanceFail++;
        const key = `${pf.subjectInfo.subjectCode}|${s.studentCode}`;
        if (seenCodes.has(key)) duplicateCodes++;
        seenCodes.add(key);
      });
    });
    return { files: pending.length, totalStudentsAll, outOfRange, duplicateCodes, missingGrade, attendanceFail, lowScore };
  })();

  const handleImportAll = async () => {
    const pending = parsedFiles.filter((f) => f.status === "pending" && f.students.length > 0);
    if (pending.length === 0) { toast.error("ไม่มีไฟล์ที่พร้อมนำเข้า"); return; }

    setImporting(true);
    let successCount = 0;

    for (let i = 0; i < parsedFiles.length; i++) {
      const pf = parsedFiles[i];
      if (pf.status !== "pending" || pf.students.length === 0) continue;

      setParsedFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: "importing" } : f));
      const ok = await importSingleFile(pf);
      setParsedFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, status: ok ? "success" : "error" } : f));
      if (ok) successCount++;
      else if (pf.error) toast.error(`${pf.subjectInfo.subjectName}: ${pf.error}`);
    }

    qc.invalidateQueries({ queryKey: ["pp5_files"] });
    qc.invalidateQueries({ queryKey: ["student_scores"] });
    qc.invalidateQueries({ queryKey: ["pp5_scores"] });
    qc.invalidateQueries({ queryKey: ["pp5_manual_score_subjects"] });
    qc.invalidateQueries({ queryKey: ["dash_scores"] });
    qc.invalidateQueries({ queryKey: ["dash_subjects"] });
    qc.invalidateQueries({ queryKey: ["subjects"] });
    qc.invalidateQueries({ queryKey: ["attendance"] });
    qc.invalidateQueries({ queryKey: ["assessment_criteria"] });
    qc.invalidateQueries({ queryKey: ["assessment_scores"] });
    qc.invalidateQueries({ queryKey: ["assessment_teacher_assignments"] });
    qc.invalidateQueries({ queryKey: ["my_teacher_assignments"] });

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

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const setCell = (ws: XLSX.WorkSheet, r: number, c: number, v: any) => {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
      ws[addr] = { t: typeof v === "number" ? "n" : "s", v };
    };
    const ensureRef = (ws: XLSX.WorkSheet, rows: number, cols: number) => {
      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows - 1, c: cols - 1 } });
    };

    // ── Home sheet ──
    const home: XLSX.WorkSheet = {};
    setCell(home, 2, 2, "ชื่อโรงเรียน");
    setCell(home, 3, 2, "โรงเรียน:");
    setCell(home, 3, 3, "");
    setCell(home, 4, 5, "ภาคเรียน:");
    setCell(home, 4, 6, 1);
    setCell(home, 5, 5, "ปีการศึกษา:");
    setCell(home, 5, 6, new Date().getFullYear() + 543);
    setCell(home, 9, 2, "ระดับชั้น:");
    setCell(home, 9, 3, "ประถมศึกษาปีที่ 1");
    setCell(home, 11, 2, "ชื่อรายวิชา:");
    setCell(home, 11, 3, "");
    setCell(home, 12, 2, "รหัสวิชา:");
    setCell(home, 12, 3, "");
    setCell(home, 15, 2, "ครูผู้สอน:");
    setCell(home, 15, 3, "");
    ensureRef(home, 18, 8);
    XLSX.utils.book_append_sheet(wb, home, "Home");

    const STUDENT_ROWS = 40;

    // ── สรุปตัดสินผลการเรียน sheet ──
    const summary: XLSX.WorkSheet = {};
    setCell(summary, 6, 5, "เวลาเรียน 80 ชั่วโมง");
    const sumHeaders = ["ที่", "รหัสนักเรียน", "ชื่อ-สกุล", "เวลาเรียน(ชม.)", "ร้อยละ", "ผ่าน/ไม่ผ่าน", "", "", "", "ระหว่างเรียน", "ปลายภาค", "รวม", "ระดับผล", "อ่านฯ", "คุณลักษณะ", "สมรรถนะ", "ผลการเรียน"];
    sumHeaders.forEach((h, i) => setCell(summary, 7, 2 + i, h));
    for (let i = 0; i < STUDENT_ROWS; i++) {
      setCell(summary, 8 + i, 2, i + 1);
    }
    ensureRef(summary, 8 + STUDENT_ROWS, 20);
    XLSX.utils.book_append_sheet(wb, summary, "สรุปตัดสินผลการเรียน");

    // ── คุณลักษณะ sheet (data rows 6+, code col 3, name col 4, totalScore col 28, summaryScore col 29) ──
    const character: XLSX.WorkSheet = {};
    setCell(character, 5, 3, "รหัสนักเรียน");
    setCell(character, 5, 4, "ชื่อ-สกุล");
    setCell(character, 5, 28, "คะแนนรวม");
    setCell(character, 5, 29, "สรุปผล");
    for (let i = 0; i < STUDENT_ROWS; i++) setCell(character, 6 + i, 2, i + 1);
    ensureRef(character, 6 + STUDENT_ROWS, 30);
    XLSX.utils.book_append_sheet(wb, character, "คุณลักษณะ");

    // ── สมรรถนะ sheet (data rows 6+, totalScore col 22, summaryScore col 23, level col 24) ──
    const competency: XLSX.WorkSheet = {};
    setCell(competency, 5, 3, "รหัสนักเรียน");
    setCell(competency, 5, 4, "ชื่อ-สกุล");
    setCell(competency, 5, 22, "คะแนนรวม");
    setCell(competency, 5, 23, "สรุปผล");
    setCell(competency, 5, 24, "ระดับ");
    for (let i = 0; i < STUDENT_ROWS; i++) setCell(competency, 6 + i, 2, i + 1);
    ensureRef(competency, 6 + STUDENT_ROWS, 25);
    XLSX.utils.book_append_sheet(wb, competency, "สมรรถนะ");

    // ── คิดวิเคราะห์ sheet (data rows 7+, totalScore col 26, summaryScore col 27, level col 28) ──
    const reading: XLSX.WorkSheet = {};
    setCell(reading, 6, 3, "รหัสนักเรียน");
    setCell(reading, 6, 4, "ชื่อ-สกุล");
    setCell(reading, 6, 26, "คะแนนรวม");
    setCell(reading, 6, 27, "สรุปผล");
    setCell(reading, 6, 28, "ระดับ");
    for (let i = 0; i < STUDENT_ROWS; i++) setCell(reading, 7 + i, 2, i + 1);
    ensureRef(reading, 7 + STUDENT_ROWS, 29);
    XLSX.utils.book_append_sheet(wb, reading, "คิดวิเคราะห์");

    XLSX.writeFile(wb, `PP5_Template_${new Date().getFullYear() + 543}.xlsx`);
    toast.success("ดาวน์โหลดเทมเพลต ปพ.5 สำเร็จ");
  };

  const gradeColorFn = (gp: number) => {
    if (gp >= 3.5) return "bg-success-soft text-success";
    if (gp >= 2.5) return "bg-info-soft text-info";
    if (gp >= 1.5) return "bg-warning-soft text-warning";
    return "bg-danger-soft text-danger";
  };

  const pendingCount = parsedFiles.filter((f) => f.status === "pending" && f.students.length > 0).length;
  const successCount = parsedFiles.filter((f) => f.status === "success").length;
  const totalStudents = parsedFiles.filter((f) => f.status === "pending").reduce((sum, f) => sum + f.students.length, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          นำเข้า ปพ.5
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            นำเข้าข้อมูลจากไฟล์ ปพ.5
          </DialogTitle>
        </DialogHeader>

        {/* Upload section - always visible */}
        <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
          <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
          <div>
            <p className="font-medium">เลือกไฟล์ ปพ.5 (.xlsx) — รองรับหลายไฟล์พร้อมกัน</p>
            <p className="text-sm text-muted-foreground">ระบบจะอ่านข้อมูลรายวิชา คะแนน เวลาเรียน และผลการประเมินอัตโนมัติ</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <Label htmlFor="pp5-file" className="sr-only">เลือกไฟล์</Label>
            <Input
              id="pp5-file"
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={handleFiles}
              className="max-w-xs cursor-pointer"
            />
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
              <Download className="w-4 h-4" />
              ดาวน์โหลดเทมเพลต
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ยังไม่มีไฟล์? ดาวน์โหลดเทมเพลตเปล่า กรอกคะแนน แล้วอัพโหลดกลับเข้ามาได้เลย
          </p>
        </div>

        {/* Parsed files list */}
        {parsedFiles.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                ไฟล์ทั้งหมด {parsedFiles.length} ไฟล์
                {pendingCount > 0 && <span className="text-muted-foreground"> • พร้อมนำเข้า {pendingCount} ไฟล์ ({totalStudents} คน)</span>}
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
                            {pf.subjectInfo.subjectName || pf.file.name}
                          </p>
                          {pf.subjectInfo.subjectCode && (
                            <Badge variant="outline" className="text-xs shrink-0">{pf.subjectInfo.subjectCode}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {pf.subjectInfo.gradeLevel && <span>{pf.subjectInfo.gradeLevel}</span>}
                          {pf.subjectInfo.semester > 0 && <span>เทอม {pf.subjectInfo.semester}</span>}
                          {pf.subjectInfo.academicYear > 0 && <span>ปี {pf.subjectInfo.academicYear}</span>}
                          {pf.students.length > 0 && <span>{pf.students.length} คน</span>}
                          {pf.subjectInfo.teacherName && <span>ครู: {pf.subjectInfo.teacherName}</span>}
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

                    {/* Expanded student list */}
                    {expandedIndex === idx && pf.students.length > 0 && (
                      <div className="mt-3 rounded-lg border overflow-x-auto max-h-[300px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">ที่</TableHead>
                              <TableHead className="w-20">รหัส</TableHead>
                              <TableHead>ชื่อ-สกุล</TableHead>
                              <TableHead className="text-center w-14">ระหว่าง</TableHead>
                              <TableHead className="text-center w-14">ปลาย</TableHead>
                              <TableHead className="text-center w-14">รวม</TableHead>
                              <TableHead className="text-center w-14">เกรด</TableHead>
                              <TableHead className="text-center w-16">อ่านฯ</TableHead>
                              <TableHead className="text-center w-16">คุณลักษณะ</TableHead>
                              <TableHead className="text-center w-16">สมรรถนะ</TableHead>
                              <TableHead className="text-center w-14">ผล</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pf.students.map((s) => (
                              <TableRow key={s.studentCode}>
                                <TableCell className="text-xs">{s.seq}</TableCell>
                                <TableCell className="font-mono text-xs">{s.studentCode}</TableCell>
                                <TableCell className="text-sm">{s.studentName}</TableCell>
                                <TableCell className="text-center text-xs">{s.courseworkScore}</TableCell>
                                <TableCell className="text-center text-xs">{s.examScore}</TableCell>
                                <TableCell className="text-center text-sm font-medium">{s.totalScore}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={gradeColorFn(s.gradePoint) + " text-xs"}>{s.grade}</Badge>
                                </TableCell>
                                <TableCell className="text-center text-xs">{s.readingAssessment || "-"}</TableCell>
                                <TableCell className="text-center text-xs">{s.characterAssessment || "-"}</TableCell>
                                <TableCell className="text-center text-xs">{s.competencyAssessment || "-"}</TableCell>
                                <TableCell className="text-center">
                                  {s.finalResult === "ผ่าน" ? (
                                    <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-danger mx-auto" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {pf.status === "error" && pf.error && (
                      <p className="text-xs text-danger mt-2">{pf.error}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Import button — opens confirmation popup first */}
            {pendingCount > 0 && (
              <div className="flex justify-end pt-2">
                <Button onClick={() => setConfirmOpen(true)} disabled={importing} className="gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  {importing ? "กำลังนำเข้า..." : `ตรวจสอบและบันทึก ${pendingCount} ไฟล์ (${totalStudents} คน)`}
                </Button>
              </div>
            )}
          </div>
        )}

        {parsedFiles.length === 0 && (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">รองรับไฟล์ ปพ.5 มาตรฐาน สพฐ.</p>
              <p>• สามารถเลือกหลายไฟล์พร้อมกันได้</p>
              <p>• ระบบจะดึงข้อมูลจากชีท Home, นักเรียน, และสรุปตัดสินผลการเรียน</p>
              <p>• คะแนนระหว่างเรียน + ปลายภาค + เกรด จะถูกนำเข้าอัตโนมัติ</p>
              <p>• หากรายวิชายังไม่มีในระบบ จะสร้างให้อัตโนมัติ</p>
            </CardContent>
          </Card>
        )}
      </DialogContent>

      {/* ── Confirmation popup with validation summary ── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              ตรวจสอบคะแนนก่อนบันทึกลงระบบ
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>โปรดตรวจสอบสรุปข้อมูลที่จะถูกบันทึก หากพบความผิดปกติให้ยกเลิกแล้วแก้ไขไฟล์ก่อน</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div className="rounded-md bg-primary/10 p-2 text-center">
                    <div className="text-xs text-muted-foreground">ไฟล์</div>
                    <div className="text-xl font-bold text-primary">{validationSummary.files}</div>
                  </div>
                  <div className="rounded-md bg-primary/10 p-2 text-center">
                    <div className="text-xs text-muted-foreground">นักเรียนรวม</div>
                    <div className="text-xl font-bold text-primary">{validationSummary.totalStudentsAll}</div>
                  </div>
                  <div className="rounded-md bg-muted p-2 text-center">
                    <div className="text-xs text-muted-foreground">เกรด 0</div>
                    <div className="text-xl font-bold">{validationSummary.lowScore}</div>
                  </div>
                  <div className={`rounded-md p-2 text-center ${validationSummary.attendanceFail > 0 ? "bg-warning-soft" : "bg-muted"}`}>
                    <div className="text-xs text-muted-foreground">เวลาเรียนไม่ผ่าน</div>
                    <div className="text-xl font-bold">{validationSummary.attendanceFail}</div>
                  </div>
                  <div className={`rounded-md p-2 text-center ${validationSummary.missingGrade > 0 ? "bg-warning-soft" : "bg-muted"}`}>
                    <div className="text-xs text-muted-foreground">ยังไม่มีเกรด</div>
                    <div className="text-xl font-bold">{validationSummary.missingGrade}</div>
                  </div>
                  <div className={`rounded-md p-2 text-center ${validationSummary.outOfRange > 0 ? "bg-danger-soft" : "bg-muted"}`}>
                    <div className="text-xs text-muted-foreground">คะแนนผิดช่วง</div>
                    <div className="text-xl font-bold">{validationSummary.outOfRange}</div>
                  </div>
                </div>

                {validationSummary.duplicateCodes > 0 && (
                  <div className="rounded-md bg-warning-soft border border-warning/30 p-2 text-warning text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    พบรหัสนักเรียนซ้ำ {validationSummary.duplicateCodes} รายการ (จะถูกบันทึกทับด้วยค่าใหม่ล่าสุด)
                  </div>
                )}
                {validationSummary.outOfRange > 0 && (
                  <div className="rounded-md bg-danger-soft border border-danger/30 p-2 text-danger text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    มีคะแนนรวมอยู่นอกช่วง 0-100 จำนวน {validationSummary.outOfRange} รายการ ควรตรวจสอบไฟล์
                  </div>
                )}

                <div className="rounded-md border p-2 text-xs space-y-1 max-h-40 overflow-y-auto">
                  {parsedFiles.filter((f) => f.status === "pending" && f.students.length > 0).map((pf, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="truncate">{pf.subjectInfo.subjectName || pf.file.name}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{pf.students.length} คน · เทอม {pf.subjectInfo.semester} · ปี {pf.subjectInfo.academicYear}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); handleImportAll(); }} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              ยืนยันบันทึกลงระบบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default PP5ImportDialog;
