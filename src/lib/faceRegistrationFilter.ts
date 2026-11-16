type RegistrationStudent = {
  first_name?: string | null;
  last_name?: string | null;
  student_code?: string | null;
  classrooms?: { grade_level?: string | null } | null;
};

export function filterFaceRegistrationStudents<T extends RegistrationStudent>(students: T[], search: string, grade: string): T[] {
  const query = search.toLocaleLowerCase().trim();
  return students.filter(student =>
    (grade === 'all' || student.classrooms?.grade_level === grade) &&
    (!query || [student.first_name, student.last_name, student.student_code]
      .some(value => (value || '').toLocaleLowerCase().includes(query)))
  );
}