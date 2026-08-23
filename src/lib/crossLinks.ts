export const LINKS = {
  student: (id: string) => `/dashboard/students/${id}`,
  classroom: (id: string) => `/dashboard/classrooms/${id}`,
  subject: (id: string) => `/dashboard/subjects/${id}`,
  personnel: (id: string) => `/dashboard/personnel/${id}`,
} as const;

export function studentSearchParams(code: string) { return `?student_code=${encodeURIComponent(code)}`; }
export function subjectSearchParams(code: string, term: string) { return `?subject=${encodeURIComponent(code)}&term=${encodeURIComponent(term)}`; }
