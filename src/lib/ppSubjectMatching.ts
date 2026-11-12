import { subjectBelongsToTerm } from "./subjectTermPolicy";

export interface ImportSubject {
  id: string;
  code?: string;
  name_th?: string;
  grade_level?: string | null;
  semester?: number | null;
}
export interface ImportSubjectContext { gradeLevel?: string | null; semester: number; academicYear: number; }
const norm = (s: string) => s.replace(/[๐-๙]/g, d => String("๐๑๒๓๔๕๖๗๘๙".indexOf(d)))
  .toLowerCase().replace(/แอนิเมชั่น/g, "แอนิเมชัน").replace(/\((พื้นฐาน|เพิ่มเติม|พ|ม)\)/g, "")
  .replace(/^(รายวิชา|วิชา)/, "").replace(/[\s.\-_/:,]+/g, "").trim();

/** Resolve only a unique curriculum identity, within the explicitly supplied file term. */
export function matchPpSubject(subjects: ImportSubject[], name: string, context: ImportSubjectContext, code?: string): string | null {
  const year = context.academicYear > 2400 ? context.academicYear - 543 : context.academicYear;
  if (!context.gradeLevel || !Number.isInteger(year) || ![1, 2, 3].includes(context.semester)) return null;
  const candidates = subjects.filter(s => s.grade_level === context.gradeLevel && subjectBelongsToTerm(s, context.semester, year));
  const unique = (rows: ImportSubject[]) => { const ids = [...new Set(rows.map(s => s.id))]; return ids.length === 1 ? ids[0] : null; };
  if (code) return unique(candidates.filter(s => norm(s.code ?? "") === norm(code)));
  const key = norm(name);
  const aliases: Record<string, string> = {
    [norm("การออกแบบและเทคโนโลยี 3")]: "ว22103",
    [norm("เชื้อเพลิงเพื่อการคมนาคมขนส่ง 3")]: "ว22203",
  };
  if (context.gradeLevel === "ม.2" && context.semester === 1 && year === 2026 && aliases[key]) {
    return unique(candidates.filter(s => norm(s.code ?? "") === norm(aliases[key])));
  }
  const exact = candidates.filter(s => norm(s.name_th ?? "") === key || norm(s.code ?? "") === key ||
    (/^ป\.[1-6]$/.test(context.gradeLevel ?? "") && /^ว1[1-6]101$/.test(s.code ?? "") && key === norm(`วิทยาศาสตร์ ${context.gradeLevel?.slice(2)}`)));
  if (exact.length) return unique(exact);
  if (/[๐-๙0-9]\s*$/.test(name) || key.length < 3) return null;
  return unique(candidates.filter(s => { const k = norm(s.name_th ?? ""); return k.startsWith(key) && /^[0-9]*$/.test(k.slice(key.length)); }));
}