import {
  ExportSchoolInfo,
  beYear,
  buildXlsxWithHeader,
  docHeaderHtml,
  openPrintWindow,
  sanitizeFn,
  signatureRowHtml,
} from "./common";

export interface PP6Row {
  student_code: string;
  full_name: string;
  subject?: string;
  score?: number | string;
  grade?: string | number;
  remark?: string;
}

/** ปพ.6 — PDF print (parent report) */
export const printPP6 = (
  info: ExportSchoolInfo,
  classroomName: string,
  semester: string | number,
  rows: PP6Row[],
) => {
  const body = rows
    .map(
      (r, i) => `
      <tr>
        <td class="text-center">${i + 1}</td>
        <td>${r.student_code}</td>
        <td>${r.full_name}</td>
        <td>${r.subject || ""}</td>
        <td class="text-center">${r.score ?? ""}</td>
        <td class="text-center">${r.grade ?? ""}</td>
        <td>${r.remark || ""}</td>
      </tr>`,
    )
    .join("");

  const html = `
    ${docHeaderHtml(info, "แบบรายงานผลการพัฒนาคุณภาพผู้เรียนรายบุคคล (ปพ.6)",
      `ชั้น ${classroomName} ภาคเรียนที่ ${semester} ปีการศึกษา ${beYear(info.academic_year as any)}`)}
    <table>
      <thead><tr>
        <th>ที่</th><th>รหัส</th><th>ชื่อ-สกุล</th><th>วิชา</th><th>คะแนน</th><th>เกรด</th><th>หมายเหตุ</th>
      </tr></thead>
      <tbody>${body || `<tr><td colspan="7" class="text-center">— ไม่มีข้อมูล —</td></tr>`}</tbody>
    </table>
    ${signatureRowHtml(info)}
  `;
  openPrintWindow(html, `ปพ.6-${classroomName}`);
};

const aoa = (rows: PP6Row[]) =>
  rows.map((r, i) => [i + 1, r.student_code, r.full_name, r.subject || "", r.score ?? "", r.grade ?? "", r.remark || ""]);

export const exportPP6Sgs = (info: ExportSchoolInfo, classroomName: string, rows: PP6Row[]) => {
  buildXlsxWithHeader(
    info,
    "PP6-SGS",
    `ปพ.6 ${classroomName}`,
    [["ลำดับ", "รหัส", "ชื่อ-สกุล", "วิชา", "คะแนน", "เกรด", "หมายเหตุ"], ...aoa(rows)],
    `PP6_SGS_${sanitizeFn(classroomName)}.xlsx`,
  );
};

export const exportPP6SchoolMis = (info: ExportSchoolInfo, classroomName: string, rows: PP6Row[]) => {
  buildXlsxWithHeader(
    info,
    "PP6-SchoolMIS",
    `ปพ.6 ${classroomName}`,
    [["NO", "STUDENT_CODE", "FULL_NAME", "SUBJECT", "SCORE", "GRADE", "REMARK"], ...aoa(rows)],
    `PP6_SchoolMIS_${sanitizeFn(classroomName)}.xlsx`,
  );
};
