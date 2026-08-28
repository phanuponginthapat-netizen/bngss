// Canonical aggregation helpers — single source of truth for KPI math.
//
// ก่อนหน้านี้สูตรสรุปข้อมูล (เกรด/การมาเรียน/การเงิน/พฤติกรรม/ทรัพย์สิน/สวัสดิภาพ)
// ถูกเขียนซ้ำใน onestop-api, district-nightly-snapshot และ district-feed-api
// ทำให้ตัวเลขในแต่ละหน้า/แต่ละ API ไม่ตรงกัน ไฟล์นี้รวมสูตรไว้ที่เดียว
// ทุกฟังก์ชันเป็น pure function (รับ rows → คืน summary) จึงใช้ซ้ำได้ทุกที่
// โดยไม่ผูกกับเงื่อนไข query ของแต่ละ endpoint

export const GPA_MAP: Record<string, number> = {
  "4": 4, "3.5": 3.5, "3": 3, "2.5": 2.5, "2": 2, "1.5": 1.5, "1": 1, "0": 0,
};

export const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const money = (n: number): number => +n.toFixed(2);

export const sumBy = <T>(rows: T[], pick: (r: T) => unknown): number =>
  rows.reduce((s, r) => s + num(pick(r)), 0);

export const countBy = <T>(rows: T[], pick: (r: T) => string | null | undefined, fallback = "ไม่ระบุ") => {
  const out: Record<string, number> = {};
  rows.forEach((r) => {
    const k = pick(r) || fallback;
    out[k] = (out[k] || 0) + 1;
  });
  return out;
};

/** สรุปผลการเรียน — เกณฑ์ผ่าน total_score >= 50, GPA จาก grade */
export function summarizeGrading(rows: any[]) {
  const grade_distribution = countBy(rows, (r) => r.grade, "-");
  let sum = 0, cnt = 0, pass = 0, fail = 0;
  rows.forEach((r) => {
    const ts = Number(r.total_score);
    if (Number.isFinite(ts)) { sum += ts; cnt++; if (ts >= 50) pass++; else fail++; }
  });
  let gpaSum = 0, gpaN = 0;
  Object.entries(grade_distribution).forEach(([g, n]) => {
    if (GPA_MAP[g] !== undefined) { gpaSum += GPA_MAP[g] * n; gpaN += n; }
  });
  return {
    total_records: rows.length,
    grade_distribution,
    average_score: cnt ? money(sum / cnt) : 0,
    school_gpa: gpaN ? money(gpaSum / gpaN) : 0,
    pass_count: pass,
    fail_count: fail,
    pass_rate: (pass + fail) ? money((pass / (pass + fail)) * 100) : 0,
  };
}

/** สรุปการมาเรียน (ตาราง attendance) */
export function summarizeAttendance(rows: any[]) {
  const summary = { present: 0, absent: 0, late: 0, leave: 0, total: rows.length };
  rows.forEach((r) => {
    if (r.status === "present") summary.present++;
    else if (r.status === "absent") summary.absent++;
    else if (r.status === "late") summary.late++;
    else if (r.status === "leave") summary.leave++;
  });
  return summary;
}

/** สรุปพฤติกรรมนักเรียน */
export function summarizeBehavior(rows: any[]) {
  return {
    total: rows.length,
    positive: rows.filter((r) => r.behavior_type === "positive").length,
    negative: rows.filter((r) => r.behavior_type === "negative").length,
    net_points: sumBy(rows, (r: any) => r.points),
  };
}

/** สรุปการเงิน — budget_transactions (+ procurement_records ถ้ามี) */
export function summarizeFinance(budgetRows: any[], procurementRows: any[] = []) {
  const income = sumBy(budgetRows.filter((r) => r.transaction_type === "income"), (r: any) => r.amount);
  const expense = sumBy(budgetRows.filter((r) => r.transaction_type === "expense"), (r: any) => r.amount);
  const expense_by_category: Record<string, number> = {};
  budgetRows.forEach((r: any) => {
    if (r.transaction_type !== "expense") return;
    const k = r.category || "อื่น ๆ";
    expense_by_category[k] = money((expense_by_category[k] || 0) + num(r.amount));
  });
  return {
    income_total: money(income),
    expense_total: money(expense),
    balance: money(income - expense),
    count: budgetRows.length,
    expense_by_category,
    procurement_total: money(sumBy(procurementRows, (r: any) => r.total_amount)),
    procurement_count: procurementRows.length,
  };
}

/** สรุปเงินสดย่อย — รองรับทั้งค่า income/in และ expense/out */
export function summarizePettyCash(rows: any[]) {
  const income = sumBy(rows.filter((r) => r.type === "income" || r.type === "in"), (r: any) => r.amount);
  const expense = sumBy(rows.filter((r) => r.type === "expense" || r.type === "out"), (r: any) => r.amount);
  return {
    income_total: money(income),
    expense_total: money(expense),
    balance: money(income - expense),
    count: rows.length,
  };
}

/** สรุปทรัพย์สิน/ครุภัณฑ์ */
export function summarizeAssets(rows: any[], totalCount?: number | null) {
  return {
    total: totalCount ?? rows.length,
    by_category: countBy(rows, (r) => r.asset_category, "อื่น ๆ"),
    by_status: countBy(rows, (r) => r.status, "unknown"),
    total_value: money(sumBy(rows, (r: any) => r.acquisition_value)),
  };
}

/** สรุปข้อมูลนักเรียน (นับเฉพาะ active สำหรับ by_grade/by_gender) */
export function summarizeStudents(rows: any[], totalCount?: number | null) {
  const by_grade: Record<string, number> = {};
  const by_gender = { male: 0, female: 0, other: 0 };
  let special_needs = 0;
  const active = rows.filter((r) => r.status === "active");
  active.forEach((s: any) => {
    const g = s.grade_level || "unknown";
    by_grade[g] = (by_grade[g] || 0) + 1;
    if (s.gender === "ชาย" || s.gender === "male") by_gender.male++;
    else if (s.gender === "หญิง" || s.gender === "female") by_gender.female++;
    else by_gender.other++;
    if (s.is_special_needs) special_needs++;
  });
  return {
    total: totalCount ?? rows.length,
    active: active.length,
    by_grade,
    by_gender,
    special_needs,
  };
}

/** สรุปบุคลากร */
export function summarizePersonnel(rows: any[], totalCount?: number | null) {
  return {
    total: totalCount ?? rows.length,
    active: rows.filter((r) => r.status === "active").length,
    by_rank: countBy(rows, (r) => r.academic_rank, "ไม่ระบุ"),
  };
}

/** สรุปการลา (ใช้ได้ทั้งนักเรียนและบุคลากร) */
export function summarizeLeaves(rows: any[]) {
  return {
    total: rows.length,
    approved: rows.filter((r) => r.status === "approved").length,
    pending: rows.filter((r) => r.status === "pending").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };
}

/** สรุปสวัสดิภาพ/อนามัย */
export function summarizeWelfare(input: {
  healthCount?: number | null;
  homeVisitCount?: number | null;
  vaccineCount?: number | null;
  sdqRows?: any[];
  sdqCount?: number | null;
}) {
  const sdqRows = input.sdqRows ?? [];
  return {
    health_visits: input.healthCount ?? 0,
    home_visits: input.homeVisitCount ?? 0,
    vaccine_records: input.vaccineCount ?? 0,
    sdq: {
      total: input.sdqCount ?? sdqRows.length,
      by_category: countBy(sdqRows, (r) => r.category, "ไม่ระบุ"),
    },
  };
}

/** สรุปโครงการ (hub_projects) */
export function summarizeProjects(rows: any[], totalCount?: number | null) {
  return {
    total: totalCount ?? rows.length,
    budget_received_total: money(sumBy(rows, (r: any) => r.budget_received)),
    budget_spent_total: money(sumBy(rows, (r: any) => r.budget_spent)),
    by_status: countBy(rows, (r) => r.status, "unknown"),
  };
}

/** สรุปห้องสมุด */
export function summarizeLibrary(books: any[], loans: any[], booksCount?: number | null) {
  const now = Date.now();
  return {
    books_total: booksCount ?? books.length,
    total_copies: sumBy(books, (b: any) => b.copies_total),
    available_copies: sumBy(books, (b: any) => b.copies_available),
    active_loans: loans.filter((l: any) => !l.returned_at).length,
    overdue_loans: loans.filter((l: any) => !l.returned_at && l.due_at && new Date(l.due_at).getTime() < now).length,
  };
}
