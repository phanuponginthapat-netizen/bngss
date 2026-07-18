// Grade calculation utilities for Thai education system

export type GradeLetter = "4" | "3.5" | "3" | "2.5" | "2" | "1.5" | "1" | "0" | "ร" | "มส";

export interface GradeResult {
  grade: string;
  gradePoint: number;
}

// Thai grading scale (standard 8 levels)
export function calculateGrade(totalScore: number, maxScore: number = 100): GradeResult {
  const percentage = (totalScore / maxScore) * 100;

  if (percentage >= 80) return { grade: "4", gradePoint: 4.0 };
  if (percentage >= 75) return { grade: "3.5", gradePoint: 3.5 };
  if (percentage >= 70) return { grade: "3", gradePoint: 3.0 };
  if (percentage >= 65) return { grade: "2.5", gradePoint: 2.5 };
  if (percentage >= 60) return { grade: "2", gradePoint: 2.0 };
  if (percentage >= 55) return { grade: "1.5", gradePoint: 1.5 };
  if (percentage >= 50) return { grade: "1", gradePoint: 1.0 };
  return { grade: "0", gradePoint: 0.0 };
}

// Calculate GPA from multiple subjects
export function calculateGPA(
  grades: { gradePoint: number; credits: number }[]
): number {
  if (grades.length === 0) return 0;

  const totalWeighted = grades.reduce((sum, g) => sum + g.gradePoint * g.credits, 0);
  const totalCredits = grades.reduce((sum, g) => sum + g.credits, 0);

  if (totalCredits === 0) return 0;
  return Math.round((totalWeighted / totalCredits) * 100) / 100;
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
