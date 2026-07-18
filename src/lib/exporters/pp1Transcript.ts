import {
  ExportSchoolInfo,
  beYear,
  buildXlsxWithHeader,
  docHeaderHtml,
  openPrintWindow,
  sanitizeFn,
  signatureRowHtml,
} from "./common";

export interface PP1Subject {
  code: string;
  name: string;
  credit: number;
  grade: number | string;
  semester?: number;
  academic_year?: number;
}

export interface PP1Student {
  student_code: string;
  prefix?: string;
  first_name: string;
  last_name: string;
  national_id?: string;
  birth_date?: string;
  grade_level?: string;
  classroom_name?: string;
  gpa?: number;
  enroll_date?: string;
  graduation_date?: string;
}

const formatName = (s: PP1Student) =>
  `${s.prefix || ""}${s.first_name} ${s.last_name}`.trim();

/** ปพ.1 — PDF (HTML print) */
export const printPP1 = (info: ExportSchoolInfo, student: PP1Student, subjects: PP1Subject[]) => {
  const rows = subjects
    .map(
      (s, i) => `
    <tr>
      <td class="text-center">${i + 1}</td>
      <td>${s.code}</td>
      <td>${s.name}</td>
      <td class="text-center">${s.credit?.toFixed?.(1) ?? s.credit}</td>
      <td class="text-center">${s.grade}</td>
    </tr>`,
    )
    .join("");

  const html = `
    ${docHeaderHtml(info, "ระเบียนแสดงผลการเรียน (ปพ.1)", `ปีการศึกษา ${beYear(info.academic_year as any)}`)}
    <table class="small" style="margin-bottom:10px;">
      <tr><td style="width:18%">ชื่อ-สกุล</td><td>${formatName(student)}</td>
          <td style="width:18%">รหัสนักเรียน</td><td>${student.student_code}</td></tr>
      <tr><td>เลขประจำตัว ปชช.</td><td>${student.national_id || "-"}</td>
          <td>วันเกิด</td><td>${student.birth_date || "-"}</td></tr>
      <tr><td>ระดับชั้น</td><td>${student.grade_level || "-"} ${student.classroom_name || ""}</td>
          <td>GPA สะสม</td><td>${student.gpa?.toFixed?.(2) ?? student.gpa ?? "-"}</td></tr>
    </table>
    <table>
      <thead><tr>
        <th style="width:6%">ที่</th>
        <th style="width:14%">รหัสวิชา</th>
        <th>ชื่อรายวิชา</th>
        <th style="width:10%">หน่วยกิต</th>
        <th style="width:10%">ผลการเรียน</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="text-center">— ไม่มีข้อมูล —</td></tr>`}</tbody>
    </table>
    ${signatureRowHtml(info)}
  `;
  openPrintWindow(html, `ปพ.1-${student.student_code}`);
};

/** ปพ.1 — Excel ตาม template SGS (สพม.) */
export const exportPP1Sgs = (info: ExportSchoolInfo, student: PP1Student, subjects: PP1Subject[]) => {
  const rows: any[][] = [
    ["ชื่อ-สกุล", formatName(student), "รหัสนักเรียน", student.student_code],
    ["เลขประจำตัว ปชช.", student.national_id || "", "วันเกิด", student.birth_date || ""],
    ["ระดับชั้น", student.grade_level || "", "ห้อง", student.classroom_name || ""],
    ["GPA สะสม", student.gpa ?? "", "", ""],
    [],
    ["ลำดับ", "รหัสวิชา", "ชื่อรายวิชา", "หน่วยกิต", "ผลการเรียน", "ภาค", "ปีการศึกษา"],
    ...subjects.map((s, i) => [
      i + 1,
      s.code,
      s.name,
      s.credit,
      s.grade,
      s.semester ?? "",
      s.academic_year ? beYear(s.academic_year) : "",
    ]),
  ];
  buildXlsxWithHeader(
    info,
    "PP1-SGS",
    "ระเบียนแสดงผลการเรียน (ปพ.1) — รูปแบบ SGS",
    rows,
    `PP1_SGS_${sanitizeFn(student.student_code)}.xlsx`,
  );
};

/** ปพ.1 — Excel ตาม template SchoolMIS (สพฐ.) */
export const exportPP1SchoolMis = (info: ExportSchoolInfo, student: PP1Student, subjects: PP1Subject[]) => {
  const rows: any[][] = [
    // SchoolMIS layout: 1 header row + student row
    ["รหัสนักเรียน", "คำนำหน้า", "ชื่อ", "นามสกุล", "เลขประจำตัวประชาชน", "วันเกิด", "ระดับชั้น", "ห้อง", "GPA"],
    [
      student.student_code,
      student.prefix || "",
      student.first_name,
      student.last_name,
      student.national_id || "",
      student.birth_date || "",
      student.grade_level || "",
      student.classroom_name || "",
      student.gpa ?? "",
    ],
    [],
    ["SUBJECT_CODE", "SUBJECT_NAME", "CREDIT", "GRADE", "SEMESTER", "ACADEMIC_YEAR"],
    ...subjects.map((s) => [
      s.code,
      s.name,
      s.credit,
      s.grade,
      s.semester ?? "",
      s.academic_year ? beYear(s.academic_year) : "",
    ]),
  ];
  buildXlsxWithHeader(
    info,
    "PP1-SchoolMIS",
    "ระเบียนแสดงผลการเรียน (ปพ.1) — รูปแบบ SchoolMIS",
    rows,
    `PP1_SchoolMIS_${sanitizeFn(student.student_code)}.xlsx`,
  );
};
