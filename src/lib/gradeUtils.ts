// Grade calculation utilities for Thai education system

export type GradeLetter = "4" | "3.5" | "3" | "2.5" | "2" | "1.5" | "1" | "0" | "ร" | "มส";

export interface GradeResult {
  grade: string;
  gradePoint: number;
}

// Thai grading scale (standard 8 levels)
export function calculateGrade(totalScore: number, maxScore: number = 100): GradeResult {
  if (!Number.isFinite(totalScore) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return { grade: "0", gradePoint: 0 };
  }
  // ปัดคะแนนรวมเป็นจำนวนเต็มก่อนตัดเกรด (79.5 -> 80) ตามแนวปฏิบัติการวัดผล สพฐ.
  const percentage = Math.round(Math.min(Math.max((totalScore / maxScore) * 100, 0), 100));

  if (percentage >= 80) return { grade: "4", gradePoint: 4.0 };
  if (percentage >= 75) return { grade: "3.5", gradePoint: 3.5 };
  if (percentage >= 70) return { grade: "3", gradePoint: 3.0 };
  if (percentage >= 65) return { grade: "2.5", gradePoint: 2.5 };
  if (percentage >= 60) return { grade: "2", gradePoint: 2.0 };
  if (percentage >= 55) return { grade: "1.5", gradePoint: 1.5 };
  if (percentage >= 50) return { grade: "1", gradePoint: 1.0 };
  return { grade: "0", gradePoint: 0.0 };
}

// Calculate GPA from multiple subjects.
// ตามระเบียบการวัดผล สพฐ.: คิดทศนิยม 2 ตำแหน่ง "ไม่ปัดเศษ" และไม่นำวิชาที่ยังเป็น ร/มส
// (gradePoint ไม่ใช่ตัวเลข) มาคิด จนกว่าจะแก้ผลการเรียนแล้ว
export function calculateGPA(
  grades: { gradePoint: number | null | undefined; credits: number }[]
): number {
  const valid = grades.filter(
    (g) => typeof g.gradePoint === "number" && Number.isFinite(g.gradePoint) && Number.isFinite(g.credits) && g.credits > 0,
  ) as { gradePoint: number; credits: number }[];
  const totalCredits = valid.reduce((sum, g) => sum + g.credits, 0);
  if (totalCredits === 0) return 0;
  const totalWeighted = valid.reduce((sum, g) => sum + g.gradePoint * g.credits, 0);
  return Math.floor((totalWeighted / totalCredits) * 100 + 1e-9) / 100;
}

export function gradeColor(grade: string): string {
  switch (grade) {
    case "4": return "bg-success/15 text-success";
    case "3.5": return "bg-success/10 text-success";
    case "3": return "bg-info/15 text-info";
    case "2.5": return "bg-info/10 text-info";
    case "2": return "bg-warning/15 text-warning";
    case "1.5": return "bg-warning/10 text-warning";
    case "1": return "bg-destructive/10 text-destructive";
    case "0": return "bg-destructive/15 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
}

export interface GradeProportion {
  duringTerm: number; // default 70
  midterm: number;    // default 10
  final: number;      // default 20
}

const DEFAULT_PROPORTION: GradeProportion = { duringTerm: 70, midterm: 10, final: 20 };

export function calculateGradeWithProportion(
  scores: { duringTerm: number; midterm: number; final: number },
  fullScores: { duringTerm: number; midterm: number; final: number },
  proportion?: GradeProportion
) {
  const p = proportion || DEFAULT_PROPORTION;
  const totalP = p.duringTerm + p.midterm + p.final;
  const duringPct = scores.duringTerm / (fullScores.duringTerm || 100);
  const midPct = scores.midterm / (fullScores.midterm || 100);
  const finalPct = scores.final / (fullScores.final || 100);
  const weighted = (duringPct * p.duringTerm + midPct * p.midterm + finalPct * p.final) / totalP;
  const pct = weighted * 100;
  return calculateGrade(pct, 100);
}

/** แสดง GPA ทศนิยม 2 ตำแหน่งแบบไม่ปัดเศษ (ระเบียบการวัดผล สพฐ.) */
export function formatGPA(totalGradePoints: number, totalCredits: number, empty = "0.00"): string {
  if (!Number.isFinite(totalGradePoints) || !Number.isFinite(totalCredits) || totalCredits <= 0) return empty;
  return (Math.floor((totalGradePoints / totalCredits) * 100 + 1e-9) / 100).toFixed(2);
}
