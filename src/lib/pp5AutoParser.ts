// obec-grade parser (used by both ปพ.5 and ปพ.6)
// Strategy: scan every sheet, find a header row that contains "เลขที่/รหัส/ประจำตัว" + "ชื่อ",
// then read numeric columns to the right as scores. Group by top header row.

import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PP5ParsedStudentRow {
  studentCode: string;
  studentName: string;
  seq?: number;
  subjects: Record<string, { columns: { header: string; value: number | string | null }[] }>;
  directTotal?: number;
  directGrade?: string;
}

export interface PP5ParsedSheet {
  sheetName: string;
  kind: "exam_scores" | "character" | "competency" | "reading_thinking" | "attendance" | "other";
  subjects: string[];
  subHeaders: string[];
  students: PP5ParsedStudentRow[];
}

export interface PP5ParsedWorkbook {
  meta: {
    schoolName?: string;
    gradeLevel?: string;
    semester?: number;
    academicYear?: number;
    teacherName?: string;
    subjectName?: string;
    subjectCode?: string;
    department?: string;
  };
  sheets: PP5ParsedSheet[];
  consolidated: {
    studentCode: string;
    studentName: string;
    perSubject: Record<
      string,
      {
        examScore?: number;
        characterLevel?: number;
        competencyLevel?: number;
        readingLevel?: number;
        attendanceHours?: number;
        totalScore?: number;
        grade?: string;
        gradeFromFile?: boolean;
      }
    >;
  }[];
}

type Grid = (string | number | null)[][];

// ─── Constants & small helpers ────────────────────────────────────────────────
const CODE_KEYS = ["เลขประจำตัว", "รหัสประจำตัว", "รหัสนักเรียน", "เลขประจำตัวนักเรียน"];
const NAME_KEYS = ["ชื่อ - สกุล", "ชื่อ-สกุล", "ชื่อสกุล", "ชื่อนักเรียน", "ชื่อ – สกุล", "ชื่อ"];
const SEQ_KEYS = ["เลขที่", "ที่", "ลำดับ"];

const HEADER = {
  aggregated: /(รวมทั้งหมด|คะแนนรวม|^รวม$|^total$|ผลรวม|เฉลี่ย|average|mean)/i,
  total: /(รวมทั้งหมด|คะแนนรวม|^รวม$|^total$|ผลรวม)/i,
  grade: /(^เกรด$|ผลการเรียน|ระดับผลการเรียน|ระดับคะแนน|เกรดเฉลี่ย)/i,
} as const;

const SKIP_SHEET_RE = /^(home|lists?|โปรแกรม|อ่านก่อนทำ|คำชี้แจง|ข้อมูลพื้นฐาน|ตัวช?ี?วัด|ตัวชีวัด|เกณฑ์|ปก|สรุป|กราฟ|แผนภูมิ|report|menu|instructions?|guide|help|ปพ\.?\s*[1-9]|กระดาษคำตอบ|บันทึก|วิเคราะห์)/i;

const nz = (v: any): string => (v === null || v === undefined ? "" : String(v).trim());
const isNum = (v: any): boolean => v !== null && v !== undefined && v !== "" && !isNaN(Number(v));
const isTotalHeader = (h: string) => HEADER.total.test((h || "").trim());
const isGradeHeader = (h: string) => HEADER.grade.test((h || "").trim());
const isAggregated = (h: string) => HEADER.aggregated.test((h || "").trim());
const isSeqHeader = (h: string) => SEQ_KEYS.some((k) => h.trim() === k || h.trim().startsWith(k));
const looksLikeStudentCode = (v: string) => /^\d{3,10}$/.test(v.replace(/\s+/g, ""));

// ─── Grid helpers ─────────────────────────────────────────────────────────────
function sheetToGrid(ws: XLSX.WorkSheet): Grid {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const grid: Grid = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: (string | number | null)[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      row.push(cell?.v ?? null);
    }
    grid.push(row);
  }
  return grid;
}

function forwardFillRow(row: (string | number | null)[]): string[] {
  const out: string[] = [];
  let last = "";
  for (const cell of row) {
    const v = nz(cell);
    if (v) last = v;
    out.push(last);
  }
  return out;
}

function findHeaderRow(grid: Grid): { rowIdx: number; codeCol: number; nameCol: number; seqCol: number } | null {
  const limit = Math.min(grid.length, 40);
  for (let r = 0; r < limit; r++) {
    const row = grid[r] || [];
    let codeCol = -1, nameCol = -1, seqCol = -1;
    for (let c = 0; c < row.length; c++) {
      const v = nz(row[c]);
      if (!v) continue;
      if (codeCol === -1 && CODE_KEYS.some((k) => v.includes(k))) codeCol = c;
      if (nameCol === -1 && NAME_KEYS.some((k) => v.includes(k))) nameCol = c;
      if (seqCol === -1 && SEQ_KEYS.some((k) => v === k || v.startsWith(k))) seqCol = c;
    }
    if (codeCol >= 0 && nameCol >= 0) return { rowIdx: r, codeCol, nameCol, seqCol };
  }
  return null;
}

function classifySheet(sheetName: string, topText: string): PP5ParsedSheet["kind"] {
  const s = sheetName + " " + topText;
  if (/คุณลักษณะ|desired|desirable/i.test(s)) return "character";
  if (/สมรรถนะ|competency/i.test(s)) return "competency";
  if (/อ่าน.*คิด|reading|read.*think/i.test(s)) return "reading_thinking";
  if (/เวลาเรียน|attendance|มาเรียน/i.test(s)) return "attendance";
  if (/คะแนน|score|exam|สอบ|ผลการเรียน/i.test(s)) return "exam_scores";
  return "other";
}

function findDataStartRow(grid: Grid, header: { rowIdx: number; codeCol: number; nameCol: number }): number {
  let dataStart = header.rowIdx + 1;
  for (let r = dataStart; r < Math.min(header.rowIdx + 6, grid.length); r++) {
    const rowVals = (grid[r] || []).map(nz).join("");
    if (rowVals.includes("คะแนนเต็ม") || rowVals.includes("ข้อ 1") || rowVals.includes("ด้านที่ 1")) {
      dataStart = r + 1;
    } else if (nz(grid[r]?.[header.codeCol]) || nz(grid[r]?.[header.nameCol])) {
      return r;
    }
  }
  return dataStart;
}

/** Classify each column: numeric score, total, grade, or skip. */
function classifyColumns(
  grid: Grid,
  topRow: string[],
  subHeaders: string[],
  header: { rowIdx: number; codeCol: number; nameCol: number; seqCol: number },
  dataStart: number
): { numericCols: number[]; totalCol: number; gradeCol: number } {
  const numericCols: number[] = [];
  let totalCol = -1, gradeCol = -1;
  const cols = topRow.length;

  for (let c = 0; c < cols; c++) {
    if (c === header.codeCol || c === header.nameCol || c === header.seqCol) continue;
    const hdr = topRow[c] || "";
    const sub = nz(subHeaders[c] || "");
    if (isSeqHeader(hdr) || isSeqHeader(sub)) continue;
    if (totalCol === -1 && (isTotalHeader(hdr) || isTotalHeader(sub))) totalCol = c;
    if (gradeCol === -1 && (isGradeHeader(hdr) || isGradeHeader(sub))) gradeCol = c;

    let numCount = 0, sampleCount = 0;
    let seqLike = true, prev = 0;
    for (let r = dataStart; r < Math.min(dataStart + 20, grid.length); r++) {
      const v = grid[r]?.[c];
      if (v === null || v === undefined || v === "") continue;
      sampleCount++;
      if (isNum(v) || /^(ดีเยี่ยม|ดี|ผ่าน|ไม่ผ่าน|มส|ร|มผ|[0-4](\.[05])?)$/i.test(String(v).trim())) numCount++;
      if (isNum(v)) {
        const n = Number(v);
        if (r === dataStart) prev = n;
        else if (n !== prev + 1) seqLike = false;
        prev = n;
      } else seqLike = false;
    }
    if (sampleCount >= 3 && seqLike && !isTotalHeader(hdr) && !isGradeHeader(hdr)) continue;
    if (sampleCount > 0 && numCount / sampleCount >= 0.6) numericCols.push(c);
  }
  return { numericCols, totalCol, gradeCol };
}

function parseSheet(sheetName: string, ws: XLSX.WorkSheet): PP5ParsedSheet | null {
  const grid = sheetToGrid(ws);
  if (!grid.length) return null;
  const header = findHeaderRow(grid);
  if (!header) return null;

  const topRow = forwardFillRow(grid[header.rowIdx] || []);
  const subRowIdx = header.rowIdx + 1;
  const subHeaders = subRowIdx < grid.length ? (grid[subRowIdx] || []).map(nz) : [];
  const topText = grid.slice(0, Math.min(6, grid.length)).flat().map(nz).join(" ");
  const kind = classifySheet(sheetName, topText);
  const dataStart = findDataStartRow(grid, header);
  const { numericCols, totalCol, gradeCol } = classifyColumns(grid, topRow, subHeaders, header, dataStart);

  const subjectSet = new Set<string>();
  for (const c of numericCols) if (topRow[c]) subjectSet.add(topRow[c]);

  const students: PP5ParsedStudentRow[] = [];
  for (let r = dataStart; r < grid.length; r++) {
    const code = nz(grid[r]?.[header.codeCol]);
    const name = nz(grid[r]?.[header.nameCol]);
    if (!code) continue;
    const seqRaw = header.seqCol >= 0 ? nz(grid[r]?.[header.seqCol]) : "";
    const seq = seqRaw && isNum(seqRaw) ? Number(seqRaw) : undefined;
    const subjects: PP5ParsedStudentRow["subjects"] = {};
    for (const c of numericCols) {
      const subjHeader = topRow[c] || `col_${c}`;
      const subHeader = subHeaders[c] || (header.rowIdx > 0 ? nz(grid[header.rowIdx - 1]?.[c]) : "") || `c${c}`;
      const raw = grid[r]?.[c];
      const value = isNum(raw) ? Number(raw) : nz(raw) || null;
      if (!subjects[subjHeader]) subjects[subjHeader] = { columns: [] };
      subjects[subjHeader].columns.push({ header: String(subHeader), value });
    }
    const directTotal = totalCol >= 0 && isNum(grid[r]?.[totalCol]) ? Number(grid[r]?.[totalCol]) : undefined;
    const directGrade = gradeCol >= 0 ? nz(grid[r]?.[gradeCol]) || undefined : undefined;
    students.push({ studentCode: code, studentName: name, seq, subjects, directTotal, directGrade });
  }

  return {
    sheetName,
    kind,
    subjects: Array.from(subjectSet),
    subHeaders: Array.from(new Set(subHeaders.filter(Boolean))),
    students,
  };
}

// ─── Meta extraction ─────────────────────────────────────────────────────────
function normalizeGradeLevel(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  const map: Array<[RegExp, string]> = [
    [/อนุบาล\s*ปีที่?\s*([1-3๑-๓])/i, "อ."],
    [/ประถมศึกษาปีที่\s*([1-6๑-๖])/i, "ป."],
    [/มัธยมศึกษาปีที่\s*([1-6๑-๖])/i, "ม."],
    [/^ป\.?\s*([1-6])/i, "ป."],
    [/^ม\.?\s*([1-6])/i, "ม."],
    [/^อ\.?\s*([1-3])/i, "อ."],
  ];
  const thaiDigit: Record<string, string> = { "๑": "1", "๒": "2", "๓": "3", "๔": "4", "๕": "5", "๖": "6" };
  for (const [re, prefix] of map) {
    const m = s.match(re);
    if (m) return `${prefix}${thaiDigit[m[1]] || m[1]}`;
  }
  return s;
}

function extractMeta(wb: XLSX.WorkBook): PP5ParsedWorkbook["meta"] {
  const meta: PP5ParsedWorkbook["meta"] = {};
  for (const name of wb.SheetNames) {
    if (!/home|โปรแกรม|ข้อมูลพื้นฐาน/i.test(name)) continue;
    const grid = sheetToGrid(wb.Sheets[name]);
    for (const row of grid) {
      for (let c = 0; c < row.length; c++) {
        const label = nz(row[c]);
        if (!label) continue;
        let val = "";
        for (let k = 1; k <= 4; k++) {
          const v = nz(row[c + k]);
          if (v) { val = v; break; }
        }
        if (!val) continue;
        if (/^โรงเรียน/i.test(label) && !meta.schoolName) meta.schoolName = val;
        else if (/^ระดับชั้น/i.test(label) && !meta.gradeLevel) meta.gradeLevel = normalizeGradeLevel(val);
        else if (/^ภาคเรียน/i.test(label) && !meta.semester && isNum(val)) meta.semester = Number(val);
        else if (/^ปีการศึกษา/i.test(label) && !meta.academicYear && isNum(val)) meta.academicYear = Number(val);
        else if (/^ปี\s*พ\.?\s*ศ/i.test(label) && !meta.academicYear && isNum(val)) meta.academicYear = Number(val);
        else if (/^(ครูผู้สอน|ผู้สอน)/i.test(label) && !meta.teacherName) meta.teacherName = val;
        else if (/^ครูประจำชั้น|ครูที่ปรึกษา/i.test(label) && !meta.teacherName) meta.teacherName = val;
        else if (/^รายวิชา/i.test(label) && !meta.subjectName) meta.subjectName = val.replace(/\s+/g, " ").trim();
        else if (/^รหัสวิชา/i.test(label) && !meta.subjectCode) meta.subjectCode = val;
        else if (/^กลุ่มสาระ/i.test(label) && !meta.department) meta.department = val;
      }
    }
  }
  return meta;
}

// ─── Consolidation ────────────────────────────────────────────────────────────
function sumNonAggregated(st: PP5ParsedStudentRow): { sum: number; count: number } {
  let sum = 0, count = 0;
  for (const subj of Object.keys(st.subjects)) {
    if (isAggregated(subj)) continue;
    for (const col of st.subjects[subj].columns) {
      if (isAggregated(col.header)) continue;
      if (typeof col.value === "number" && !isNaN(col.value)) { sum += col.value; count++; }
    }
  }
  return { sum, count };
}

const isMainScoreSheet = (name: string) =>
  /คะแนน/.test(name) && !/(รายข้อ|รายด้าน|ตัวชี้วัด|วิเคราะห์)/i.test(name);

function computeGrade(pct: number): string {
  return pct >= 80 ? "4" : pct >= 75 ? "3.5" : pct >= 70 ? "3" : pct >= 65 ? "2.5"
       : pct >= 60 ? "2" : pct >= 55 ? "1.5" : pct >= 50 ? "1" : "0";
}

function applyToBucket(
  bucket: any,
  sh: PP5ParsedSheet,
  st: PP5ParsedStudentRow,
  sum: number,
  count: number
) {
  const avg = count > 0 ? sum / count : 0;
  const value = st.directTotal !== undefined ? st.directTotal : (sh.kind === "exam_scores" ? sum : Math.round(avg * 100) / 100);

  if (sh.kind === "exam_scores") {
    if (isMainScoreSheet(sh.sheetName)) {
      bucket.examScore = Math.max(bucket.examScore ?? 0, Math.round(value * 100) / 100);
      if (st.directGrade) { bucket.grade = st.directGrade; bucket.gradeFromFile = true; }
    } else if (bucket.examScore === undefined) {
      bucket._fallbackExam = Math.max(bucket._fallbackExam ?? 0, Math.round(value * 100) / 100);
      if (st.directGrade && !bucket.grade) { bucket.grade = st.directGrade; bucket.gradeFromFile = true; }
    }
  } else if (sh.kind === "character") {
    bucket.characterLevel = Math.max(bucket.characterLevel || 0, value);
  } else if (sh.kind === "competency") {
    bucket.competencyLevel = Math.max(bucket.competencyLevel || 0, value);
  } else if (sh.kind === "reading_thinking") {
    bucket.readingLevel = Math.max(bucket.readingLevel || 0, value);
  } else if (sh.kind === "attendance") {
    const hrs = st.directTotal !== undefined ? st.directTotal : sum;
    if (hrs > 0) bucket.attendanceHours = Math.max(bucket.attendanceHours || 0, Math.round(hrs));
  }
}

function finalizeBucket(s: any) {
  if (s.examScore === undefined && s._fallbackExam !== undefined) s.examScore = s._fallbackExam;
  delete s._fallbackExam;
  if (typeof s.examScore === "number") {
    const pct = Math.min(100, s.examScore);
    s.totalScore = Math.round(pct * 100) / 100;
    if (!s.gradeFromFile) s.grade = computeGrade(pct);
  }
}

function consolidate(sheets: PP5ParsedSheet[], meta: PP5ParsedWorkbook["meta"]): PP5ParsedWorkbook["consolidated"] {
  const canonicalSubject = meta.subjectName?.trim() || "รายวิชา";
  const byStudent = new Map<string, { studentCode: string; studentName: string; perSubject: Record<string, any> }>();

  for (const sh of sheets) {
    for (const st of sh.students) {
      const key = st.studentCode;
      if (!byStudent.has(key)) {
        byStudent.set(key, { studentCode: key, studentName: st.studentName, perSubject: { [canonicalSubject]: {} } });
      }
      const rec = byStudent.get(key)!;
      if (!rec.perSubject[canonicalSubject]) rec.perSubject[canonicalSubject] = {};
      const bucket = rec.perSubject[canonicalSubject];
      const { sum, count } = sumNonAggregated(st);
      if (count === 0 && st.directTotal === undefined && !st.directGrade) continue;
      applyToBucket(bucket, sh, st, sum, count);
    }
  }
  for (const rec of byStudent.values()) for (const s of Object.values(rec.perSubject)) finalizeBucket(s);
  return Array.from(byStudent.values());
}

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function parsePP5Workbook(file: File | ArrayBuffer): Promise<PP5ParsedWorkbook> {
  const buf = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheets: PP5ParsedSheet[] = [];
  for (const name of wb.SheetNames) {
    if (SKIP_SHEET_RE.test(name.trim())) continue;
    try {
      const parsed = parseSheet(name, wb.Sheets[name]);
      if (!parsed) continue;
      const realStudents = parsed.students.filter((s) => looksLikeStudentCode(s.studentCode));
      if (realStudents.length === 0) continue;
      parsed.students = realStudents;
      if (parsed.kind === "other" && parsed.subjects.length === 0) continue;
      sheets.push(parsed);
    } catch (e) {
      console.warn("PP5 parse sheet failed:", name, e);
    }
  }
  const meta = extractMeta(wb);
  return { meta, sheets, consolidated: consolidate(sheets, meta) };
}
