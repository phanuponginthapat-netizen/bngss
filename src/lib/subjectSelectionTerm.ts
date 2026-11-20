import { subjectBelongsToTerm } from "./subjectTermPolicy";

export interface SelectionTerm { academicYear: number; semester: number }
export interface TermSubject { code?: string; grade_level?: string | null; academic_year?: number | null; semester?: number | null }
export const selectionYearCE = (year: number) => year > 2400 ? year - 543 : year;
export function subjectInSelectionTerm(subject: TermSubject, term: SelectionTerm): boolean {
  if (!(term.academicYear > 0) || ![1, 2].includes(term.semester)) return false;
  if (subject.academic_year != null && selectionYearCE(subject.academic_year) !== selectionYearCE(term.academicYear)) return false;
  return subjectBelongsToTerm(subject, term.semester, term.academicYear);
}
export function assignmentInSelectionTerm(row: { academic_year?: number | null; semester?: number | null; subjects?: TermSubject | null }, term: SelectionTerm): boolean {
  return row.academic_year != null && selectionYearCE(row.academic_year) === selectionYearCE(term.academicYear)
    && Number(row.semester) === term.semester && !!row.subjects && subjectInSelectionTerm(row.subjects, term);
}
export function remediationSelectionTerms(current: SelectionTerm): SelectionTerm[] {
  if (!(current.academicYear > 0) || ![1, 2].includes(current.semester)) return [];
  return [current, { academicYear: current.semester === 1 ? current.academicYear - 1 : current.academicYear, semester: current.semester === 1 ? 2 : 1 }];
}