export function mapWarehouseFacts(faces: any[], grades: any[], budgets: any[], at: string) {
  for (const g of grades) {
    if (!g.student_code || !g.subject_id || !Number.isInteger(g.academic_year) || ![1, 2, 3].includes(g.semester)) {
      throw new Error("Score source is missing its explicit student/subject/year/semester key");
    }
  }
  return {
    attendance: faces.map(r => ({ id: r.id, student_id: r.student_id, scan_date: r.scan_date,
      scan_time: r.scan_time, scan_type: r.scan_type, entry_method: r.entry_method, source: "face_scan_logs", etl_at: at })),
    grades: grades.map(r => ({ id: r.id, student_code: r.student_code, subject_id: r.subject_id,
      total_score: r.total_score, grade: r.grade, grade_point: r.grade_point,
      academic_year: r.academic_year, semester: r.semester, source_updated_at: r.updated_at, etl_at: at })),
    finance: budgets.map(r => ({ id: `budget_${r.id}`, source_id: r.id, source_table: "budget_transactions",
      amount: r.amount, type: r.transaction_type, category: r.category, transaction_date: r.transaction_date, etl_at: at })),
  };
}