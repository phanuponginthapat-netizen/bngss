import { describe, expect, it } from 'vitest';
import { filterFaceRegistrationStudents } from '../faceRegistrationFilter';

const students = [
  { student_code: '001', first_name: 'สมชาย', classrooms: { grade_level: 'ม.1' } },
  { student_code: '002', first_name: 'สมหญิง', classrooms: { grade_level: 'ม.2' } },
  { student_code: '003', first_name: 'สมศรี', classrooms: null },
];

describe('face registration student filters', () => {
  it('shows only the selected grade', () => {
    expect(filterFaceRegistrationStudents(students, '', 'ม.1').map(s => s.student_code)).toEqual(['001']);
  });
  it('combines grade and name or code search', () => {
    expect(filterFaceRegistrationStudents(students, '002', 'ม.1')).toEqual([]);
    expect(filterFaceRegistrationStudents(students, 'หญิง', 'ม.2').map(s => s.student_code)).toEqual(['002']);
  });
  it('keeps unassigned students and all results when no grade is selected', () => {
    expect(filterFaceRegistrationStudents(students, '', 'all')).toHaveLength(3);
    expect(filterFaceRegistrationStudents(Array.from({ length: 170 }, () => students[0]), '', 'all')).toHaveLength(170);
  });
});