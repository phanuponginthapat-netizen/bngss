/** Never mix unscoped legacy records or another academic term into score status. */
export function matchesAcademicTerm(
  row: { academic_year?: number | null; semester?: number | null },
  yearBE: number,
  semester: number,
): boolean {
  return (semester === 1 || semester === 2) && row.semester === semester &&
    (row.academic_year === yearBE || row.academic_year === yearBE - 543);
}