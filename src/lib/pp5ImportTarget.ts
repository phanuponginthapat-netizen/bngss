import { requirePp6ImportTerm } from "./pp6ImportTarget";
import { subjectBelongsToTerm } from "./subjectTermPolicy";
import type { MyTeacherAssignment } from "@/hooks/useMyTeacherAssignments";

export function requirePp5ImportTarget(meta: { gradeLevel?: string; academicYear?: number; semester?: number }, chosen?: MyTeacherAssignment) {
  const term = requirePp6ImportTerm(meta);
  const year = term.year > 2400 ? term.year - 543 : term.year;
  if (!chosen) throw new Error("กรุณาเลือกวิชาและห้องเรียนก่อนนำเข้า ปพ.5");
  if (!meta.gradeLevel || chosen.gradeLevel !== meta.gradeLevel) throw new Error("วิชาที่เลือกไม่ตรงระดับชั้นในไฟล์");
  if (chosen.academicYear !== year || chosen.semester !== term.semester || !subjectBelongsToTerm({ code: chosen.subjectCode, grade_level: chosen.gradeLevel, semester: chosen.subjectSemester }, Number(term.semester), year)) {
    throw new Error("วิชาที่เลือกไม่ตรงปีการศึกษาและภาคเรียนในไฟล์");
  }
  return { ...term, gradeLevel: meta.gradeLevel };
}