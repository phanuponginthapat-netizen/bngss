import { ExportSchoolInfo, beYear, docHeaderHtml, openPrintWindow, signatureRowHtml } from "./common";

export interface PP5Column {
  id: string;
  column_name: string;
  column_type: string;
  max_score: number;
}
export interface PP5StudentRow {
  student_code: string;
  full_name: string;
  scores: Record<string, number | string>;
  during: number;
  final: number;
  total: number;
  grade: string | number;
}

/** ปพ.5 — PDF print */
export const printPP5 = (
  info: ExportSchoolInfo,
  meta: { subject_code?: string; subject_name?: string; classroom?: string; teacher?: string; semester?: number; academic_year?: number },
  columns: PP5Column[],
  students: PP5StudentRow[],
) => {
  const head = columns.map((c) => `<th>${c.column_name}<br/><span class="small">(${c.max_score})</span></th>`).join("");
  const rows = students
    .map((s, i) => {
      const cells = columns.map((c) => `<td class="text-center">${s.scores[c.id] ?? ""}</td>`).join("");
      return `<tr>
        <td class="text-center">${i + 1}</td>
        <td>${s.student_code}</td>
        <td>${s.full_name}</td>
        ${cells}
        <td class="text-center">${s.during.toFixed(2)}</td>
        <td class="text-center">${s.final.toFixed(2)}</td>
        <td class="text-center"><b>${s.total.toFixed(2)}</b></td>
        <td class="text-center"><b>${s.grade}</b></td>
      </tr>`;
    })
    .join("");

  const html = `
    ${docHeaderHtml(
      info,
      "แบบบันทึกพัฒนาคุณภาพผู้เรียน (ปพ.5)",
      `${meta.subject_code || ""} ${meta.subject_name || ""} • ${meta.classroom || ""} • ภาคเรียนที่ ${meta.semester ?? "-"} / ${beYear(meta.academic_year as any)}`,
    )}
    <table class="small">
      <thead><tr>
        <th>ที่</th><th>รหัส</th><th>ชื่อ-สกุล</th>
        ${head}
        <th>ระหว่าง</th><th>ปลายภาค</th><th>รวม</th><th>เกรด</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="${7 + columns.length}" class="text-center">— ไม่มีข้อมูล —</td></tr>`}</tbody>
    </table>
    <div class="small" style="margin-top:14px;">ครูผู้สอน: ${meta.teacher || "............................."}</div>
    ${signatureRowHtml(info)}
  `;
  openPrintWindow(html, `ปพ.5-${meta.subject_code || ""}`);
};
