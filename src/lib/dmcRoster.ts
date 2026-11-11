/** Never publish a partially read DMC roster as complete. */
export async function loadDmcRows<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 500,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await read(from, from + pageSize - 1);
    if (result.error) throw result.error;
    if (!result.data) throw new Error("ไม่ได้รับข้อมูลทะเบียน กรุณาลองใหม่");
    rows.push(...result.data);
    if (result.data.length < pageSize) return rows;
  }
}

type DmcStudent = {
  student_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  national_id?: string | null;
  status?: string | null;
  is_special_needs?: boolean | null;
  classrooms?: { grade_level?: string | null } | null;
};

export function filterDmcStudents<T extends DmcStudent>(
  students: T[], filters: { search: string; grade: string; status: string; special: boolean },
): T[] {
  const search = filters.search.trim().toLowerCase();
  return students.filter(s => {
    const match = !search || [s.student_code, s.first_name, s.last_name, s.national_id,
      `${s.first_name ?? ""} ${s.last_name ?? ""}`].some(value => value?.toLowerCase().includes(search));
    return match && (filters.grade === "all" || s.classrooms?.grade_level === filters.grade)
      && (filters.status === "all" || s.status === filters.status)
      && (!filters.special || !!s.is_special_needs);
  });
}