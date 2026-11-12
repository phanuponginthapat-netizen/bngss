/** Missing term metadata must block import instead of silently choosing the current year or semester 1. */
export function requirePp6ImportTerm(meta: { semester?: number; academicYear?: number }) {
  const year = meta.academicYear;
  if (!year || !Number.isInteger(year) || ![1, 2, 3].includes(meta.semester ?? 0)) {
    throw new Error("ไฟล์ต้องระบุปีการศึกษาและภาคเรียนให้ชัดเจนก่อนนำเข้า");
  }
  return { year, semester: meta.semester };
}